import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  runFfmpegWithWatchdog,
  loadFfmpeg,
  isFFLoaded,
  isFFmpegBusy,
  acquireFfmpegLock,
  releaseFfmpegLock,
  resetFfmpeg,
  isWorkerAborted,
  isMtFailed,
  resetMtFailedForTests,
  getFfmpegGeneration,
  verifyFfmpegHealth,
  getActiveWorkerBlobUrlForTesting,
  WatchdogTimeoutError,
  type FfmpegLockLease,
} from '../ffmpeg'

const { mockGlobalFfInstance, mockToBlobURL } = vi.hoisted(() => {
  const instance = {
    load: vi.fn(),
    terminate: vi.fn(),
    exec: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    deleteFile: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    loaded: false,
  }
  const toBlobURLFn = vi.fn().mockImplementation(async (url: string) => `blob:${url}`)
  return { mockGlobalFfInstance: instance, mockToBlobURL: toBlobURLFn }
})

vi.mock('@ffmpeg/ffmpeg', () => {
  return {
    FFmpeg: vi.fn().mockImplementation(function () {
      return mockGlobalFfInstance
    }),
  }
})

vi.mock('@ffmpeg/util', () => {
  return {
    toBlobURL: (...args: unknown[]) => mockToBlobURL(...args),
    fetchFile: vi.fn(),
  }
})

// Helper to create an EventEmitter-compatible mock FFmpeg object for testing
function createMockFf() {
  const listeners: Record<string, ((data: any) => void)[]> = {
    log: [],
    progress: [],
  }

  const mock = {
    on: vi.fn((event: string, cb: (data: any) => void) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(cb)
    }),
    off: vi.fn((event: string, cb: (data: any) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== cb)
      }
    }),
    exec: vi.fn().mockImplementation(async (args: string[]) => {
      // Default benign behavior: exit 0
      return 0
    }),
    terminate: vi.fn(),
    loaded: true,
    emitLog: (message: string) => {
      (listeners['log'] || []).forEach(cb => cb({ message }))
    },
    emitProgress: (progress: number) => {
      (listeners['progress'] || []).forEach(cb => cb({ progress }))
    },
    listeners,
  }

  return mock
}

describe('CalmClip FFmpeg Error Recovery & Lifecycle (Assignment 008 Revised)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetFfmpeg()
    resetMtFailedForTests()
    mockGlobalFfInstance.load.mockReset()
    mockGlobalFfInstance.load.mockResolvedValue(true)
    mockGlobalFfInstance.terminate.mockReset()
    mockToBlobURL.mockReset()
    mockToBlobURL.mockImplementation(async (url: string) => `blob:${url}`)
  })

  afterEach(() => {
    resetFfmpeg()
    resetMtFailedForTests()
    // @ts-expect-error test cleanup
    delete globalThis.crossOriginIsolated
    // @ts-expect-error test cleanup
    delete globalThis.SharedArrayBuffer
  })

  it('1. exec() returns 0 while emitting Aborted() in logs without marking worker dead', async () => {
    const mockFf = createMockFf()
    mockFf.exec.mockImplementation(async () => {
      mockFf.emitLog('Aborted()')
      mockFf.emitLog('bench: utime=0.038s stime=0.000s')
      return 0
    })

    await expect(
      runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-i', 'test.mp4', '-f', 'null', '-']),
    ).resolves.toBeUndefined()

    expect(mockFf.terminate).not.toHaveBeenCalled()
    expect(isWorkerAborted()).toBe(false)
  })

  it('2. nonzero FFmpeg exit code throws without worker destruction', async () => {
    const mockFf = createMockFf()
    mockFf.exec.mockImplementation(async () => {
      mockFf.emitLog('[mp4 @ 0x123] moov atom not found')
      return 1
    })

    await expect(
      runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-i', 'corrupt.mp4']),
    ).rejects.toThrow(/FFmpeg exited with code 1/)

    // Command-level failure must not terminate the worker
    expect(mockFf.terminate).not.toHaveBeenCalled()
    expect(isWorkerAborted()).toBe(false)
  })

  it('3. operation-level Promise rejection followed by successful health check retains worker', async () => {
    const mockFf = createMockFf()

    mockFf.exec.mockImplementation(async (args: string[]) => {
      if (args[0] === '-version') {
        // Health check passes!
        return 0
      }
      // Operational task rejects (e.g. FFMessageType.ERROR from worker handler)
      throw new Error('Worker operation error: demuxing failed')
    })

    // Original operation error must still be thrown to caller
    await expect(
      runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-i', 'bad_stream.mp4']),
    ).rejects.toThrow(/Worker operation error: demuxing failed/)

    // Because health check passed, worker must NOT be terminated
    expect(mockFf.terminate).not.toHaveBeenCalled()
    expect(isWorkerAborted()).toBe(false)
  })

  it('4. health check failure after rejection triggers worker termination and recovery', async () => {
    const mockFf = createMockFf()

    mockFf.exec.mockImplementation(async (args: string[]) => {
      if (args[0] === '-version') {
        // Health check itself fails (returns non-zero or throws)
        return 1
      }
      throw new Error('Fatal worker crash')
    })

    await expect(
      runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-i', 'crash.mp4']),
    ).rejects.toThrow(/Fatal worker crash/)

    // Health check failed, so worker MUST be terminated and marked aborted
    expect(mockFf.terminate).toHaveBeenCalledTimes(1)
    expect(isWorkerAborted()).toBe(true)
  })

  it('5. health check timeout after rejection triggers worker termination and recovery', async () => {
    vi.useFakeTimers()
    try {
      const mockFf = createMockFf()

      mockFf.exec.mockImplementation(async (args: string[]) => {
        if (args[0] === '-version') {
          // Health check hangs and never returns
          return new Promise<number>(() => {})
        }
        throw new Error('Worker hung during transcode')
      })

      const rejectionPromise = expect(
        runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-i', 'hang.mp4']),
      ).rejects.toThrow(/Worker hung during transcode/)

      // Advance clock past HEALTH_CHECK_TIMEOUT_MS (3000ms)
      await vi.advanceTimersByTimeAsync(3500)
      await rejectionPromise

      // Health check timed out, so worker MUST be terminated and marked aborted
      expect(mockFf.terminate).toHaveBeenCalledTimes(1)
      expect(isWorkerAborted()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('6. watchdog timeout triggers worker termination directly without running health check', async () => {
    vi.useFakeTimers()
    try {
      const mockFf = createMockFf()

      mockFf.exec.mockImplementation(async (args: string[]) => {
        // Unresponsive command that hangs indefinitely
        return new Promise<number>(() => {})
      })

      const rejectionPromise = expect(
        runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-i', 'stall.mp4'], 60_000),
      ).rejects.toThrow(/The video processing engine stopped responding/)

      // Advance clock past stale threshold
      await vi.advanceTimersByTimeAsync(75_000)
      await rejectionPromise

      // Watchdog timeout must directly terminate the worker and mark it aborted
      expect(mockFf.terminate).toHaveBeenCalledTimes(1)
      expect(isWorkerAborted()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('7. intentional reset during execution cancels operation without false MT failure', async () => {
    const mockFf = createMockFf()

    let cancelTriggered = false
    mockFf.exec.mockImplementation(async () => {
      // Simulate resetFfmpeg() called while exec is pending
      return new Promise<number>((_, reject) => {
        setTimeout(() => {
          cancelTriggered = true
          resetFfmpeg() // Intentional application reset
          reject(new Error('called FFmpeg.terminate()'))
        }, 10)
      })
    })

    await expect(
      runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-i', 'user_cancelled.mp4']),
    ).rejects.toThrow(/Operation was cancelled|called FFmpeg\.terminate\(\)/)

    expect(cancelTriggered).toBe(true)
    // Intentional reset must NOT mark MT as failed
    expect(isMtFailed()).toBe(false)
    expect(isWorkerAborted()).toBe(false)
  })

  it('8. no false MT failure following intentional reset across multiple lifecycles', () => {
    expect(isMtFailed()).toBe(false)

    // Run resetFfmpeg()
    resetFfmpeg()
    expect(isMtFailed()).toBe(false)
    expect(isWorkerAborted()).toBe(false)

    // Monotonic generation counter increments
    const gen1 = getFfmpegGeneration()
    resetFfmpeg()
    const gen2 = getFfmpegGeneration()
    expect(gen2).toBeGreaterThan(gen1)
    expect(isMtFailed()).toBe(false)
  })

  it('9. lock is released safely via try/finally pattern across all failure modes', async () => {
    const mockFf = createMockFf()

    const executeWithLock = async (scenario: 'success' | 'exit1' | 'recoverable' | 'unrecoverable') => {
      const lease = acquireFfmpegLock()
      try {
        if (scenario === 'success') {
          mockFf.exec.mockResolvedValueOnce(0)
        } else if (scenario === 'exit1') {
          mockFf.exec.mockResolvedValueOnce(1)
        } else if (scenario === 'recoverable') {
          mockFf.exec.mockImplementation(async (args: string[]) => {
            if (args[0] === '-version') return 0
            throw new Error('Recoverable error')
          })
        } else if (scenario === 'unrecoverable') {
          mockFf.exec.mockImplementation(async (args: string[]) => {
            if (args[0] === '-version') return 1
            throw new Error('Fatal error')
          })
        }
        await runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-test'])
      } finally {
        releaseFfmpegLock(lease)
      }
    }

    // Success outcome
    await expect(executeWithLock('success')).resolves.toBeUndefined()
    expect(isFFmpegBusy()).toBe(false)

    // Exit 1 outcome
    await expect(executeWithLock('exit1')).rejects.toThrow()
    expect(isFFmpegBusy()).toBe(false)

    // Recoverable rejection outcome
    await expect(executeWithLock('recoverable')).rejects.toThrow()
    expect(isFFmpegBusy()).toBe(false)

    // Unrecoverable rejection outcome
    await expect(executeWithLock('unrecoverable')).rejects.toThrow()
    expect(isFFmpegBusy()).toBe(false)

    // Lock can be acquired immediately
    const lease = acquireFfmpegLock()
    expect(isFFmpegBusy()).toBe(true)
    releaseFfmpegLock(lease)
    expect(isFFmpegBusy()).toBe(false)
  })

  it('10. successful reuse after a recoverable operation error', async () => {
    const mockFf = createMockFf()
    let commandCount = 0

    mockFf.exec.mockImplementation(async (args: string[]) => {
      commandCount++
      if (args[0] === '-version') {
        // Health check
        return 0
      }
      if (args[1] === 'bad_input.mp4') {
        // First command encounters a recoverable worker error
        throw new Error('Invalid codec parameter in stream')
      }
      // Subsequent command succeeds
      return 0
    })

    // Operation 1 fails with recoverable error
    await expect(
      runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-i', 'bad_input.mp4']),
    ).rejects.toThrow(/Invalid codec parameter/)

    // Worker was verified healthy and NOT terminated
    expect(mockFf.terminate).not.toHaveBeenCalled()
    expect(isWorkerAborted()).toBe(false)

    // Operation 2 on the SAME instance succeeds immediately
    await expect(
      runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-i', 'good_input.mp4']),
    ).resolves.toBeUndefined()

    expect(mockFf.terminate).not.toHaveBeenCalled()
    expect(isWorkerAborted()).toBe(false)
  })

  it('11. lease ownership prevents stale finally blocks from unlocking newer operations', () => {
    // Operation A acquires lock
    const leaseA = acquireFfmpegLock()
    expect(isFFmpegBusy()).toBe(true)

    // Operation A fails or is cancelled; resetFfmpeg() is called
    resetFfmpeg()
    expect(isFFmpegBusy()).toBe(false)

    // Operation B acquires lock
    const leaseB = acquireFfmpegLock()
    expect(isFFmpegBusy()).toBe(true)

    // Delayed finally block of Operation A unwinds and calls releaseFfmpegLock with leaseA
    releaseFfmpegLock(leaseA)

    // Operation B must STILL retain the lock!
    expect(isFFmpegBusy()).toBe(true)

    // A concurrent Operation C trying to acquire the lock must be rejected
    expect(() => acquireFfmpegLock()).toThrow(/A video processing task is in progress/)

    // Operation B completes and releases with its own lease
    releaseFfmpegLock(leaseB)
    expect(isFFmpegBusy()).toBe(false)

    // Now Operation C can acquire the lock
    const leaseC = acquireFfmpegLock()
    expect(isFFmpegBusy()).toBe(true)

    // An invalid or unrelated lease must not release the active lock
    const unrelatedLease = Symbol('unrelated-lease')
    releaseFfmpegLock(unrelatedLease)
    expect(isFFmpegBusy()).toBe(true)

    // Compile-time regression check: releaseFfmpegLock requires a mandatory lease argument
    // @ts-expect-error Expected 1 arguments, but got 0. An invocation without lease must fail type checking
    releaseFfmpegLock()
    expect(isFFmpegBusy()).toBe(true)

    releaseFfmpegLock(leaseC)
    expect(isFFmpegBusy()).toBe(false)
  })

  it('12. reset while health check is in-flight cancels operation without marking new generation aborted', async () => {
    const mockFf = createMockFf()

    mockFf.exec.mockImplementation(async (args: string[]) => {
      if (args[0] === '-version') {
        // Health check probe hangs until reset occurs
        return new Promise<number>((resolve) => {
          setTimeout(() => {
            // While health check is running, intentional reset happens
            resetFfmpeg()
            // Probe subsequently fails on the terminated instance
            resolve(1)
          }, 10)
        })
      }
      throw new Error('Initial transcode error')
    })

    // Op A fails and triggers health probe
    await expect(
      runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-i', 'test.mp4']),
    ).rejects.toThrow(/Operation was cancelled|Initial transcode error/)

    // The post-probe generation check detected the reset.
    // It must NOT have marked the new generation as aborted!
    expect(isWorkerAborted()).toBe(false)
  })

  it('13. ongoing progress stall mid-encode is detected and terminated by watchdog', async () => {
    vi.useFakeTimers()
    try {
      const mockFf = createMockFf()

      mockFf.exec.mockImplementation(async () => {
        // First log line
        mockFf.emitLog('Input #0, mov,mp4,m4a,3gp,3g2,mj2')
        // Progress starts and reaches 25%
        mockFf.emitProgress(0.25)

        // Then worker freezes: logs continue to arrive (healthy activity) but progress stalls
        setInterval(() => {
          mockFf.emitLog('frame= 120 fps=0.0 q=28.0 size= 1024kB time=00:00:04.00')
        }, 1_000)

        return new Promise<number>(() => {
          // Never resolves
        })
      })

      const rejectionPromise = expect(
        runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-i', 'stall.mp4'], {
          expectsProgress: true,
          progressStaleMs: 30_000,
          startupGraceMs: 30_000,
        }),
      ).rejects.toThrow(/The export stalled and made no progress for 2 minutes/)

      // Advance clock past progressStaleMs
      await vi.advanceTimersByTimeAsync(35_000)
      await rejectionPromise

      // Worker must be terminated and marked aborted
      expect(mockFf.terminate).toHaveBeenCalledTimes(1)
      expect(isWorkerAborted()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('14. startup grace period allows long initialization without false watchdog timeout', async () => {
    vi.useFakeTimers()
    try {
      const mockFf = createMockFf()

      let finishExec: (code: number) => void
      const execPromise = new Promise<number>((resolve) => {
        finishExec = resolve
      })

      mockFf.exec.mockImplementation(async () => {
        // Initial logs arrive during slow startup (e.g. loudnorm pass 1 analysis)
        mockFf.emitLog('Parsed_loudnorm_0: Input Integrated: -24.2 LUFS')
        return execPromise
      })

      const runPromise = runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-i', 'slow_init.mp4'], {
        expectsProgress: true,
        startupGraceMs: 60_000,
        progressStaleMs: 60_000,
      })

      // Advance clock 45 seconds (within grace period). Ongoing logs arrive.
      await vi.advanceTimersByTimeAsync(45_000)
      mockFf.emitLog('Parsed_loudnorm_0: still analyzing...')

      // At 50 seconds, progress begins to arrive
      mockFf.emitProgress(0.05)

      // Encoding completes
      finishExec!(0)
      await expect(runPromise).resolves.toBeUndefined()

      expect(mockFf.terminate).not.toHaveBeenCalled()
      expect(isWorkerAborted()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('15. startup grace period exceeded without progress triggers watchdog timeout', async () => {
    vi.useFakeTimers()
    try {
      const mockFf = createMockFf()

      mockFf.exec.mockImplementation(async () => {
        mockFf.emitLog('Initial filter initialization...')
        // Emits logs periodically but never emits any progress
        setInterval(() => {
          mockFf.emitLog('Infinite filter loop...')
        }, 1_000)
        return new Promise<number>(() => {})
      })

      const rejectionPromise = expect(
        runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-i', 'hang_loop.mp4'], {
          expectsProgress: true,
          startupGraceMs: 30_000,
          progressStaleMs: 30_000,
        }),
      ).rejects.toThrow(/The export started but produced no output frames for 2 minutes/)

      await vi.advanceTimersByTimeAsync(35_000)
      await rejectionPromise

      expect(mockFf.terminate).toHaveBeenCalledTimes(1)
      expect(isWorkerAborted()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('16. non-progress operation with continuous logging does not time out', async () => {
    vi.useFakeTimers()
    try {
      const mockFf = createMockFf()

      let finishExec: (code: number) => void
      const execPromise = new Promise<number>((resolve) => {
        finishExec = resolve
      })

      mockFf.exec.mockImplementation(async () => {
        mockFf.emitLog('silence_start: 1.5')
        return execPromise
      })

      // Default expectsProgress is false (e.g. silence detect, audio extraction, copy)
      const runPromise = runFfmpegWithWatchdog(
        mockFf as unknown as FFmpeg,
        ['-af', 'silencedetect', '-f', 'null', '-'],
        60_000,
      )

      // Advance clock 45 seconds while emitting logs
      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(10_000)
        mockFf.emitLog(`silence_end: ${i * 2}`)
      }

      finishExec!(0)
      await expect(runPromise).resolves.toBeUndefined()

      expect(mockFf.terminate).not.toHaveBeenCalled()
      expect(isWorkerAborted()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('17. stale asynchronous load discarded on reset without polluting state', async () => {
    let finishLoad: () => void
    const loadDeferred = new Promise<void>((resolve) => {
      finishLoad = resolve
    })

    mockGlobalFfInstance.load.mockImplementation(async () => {
      await loadDeferred
    })

    // Start asynchronous loading
    const loadPromise = loadFfmpeg()
    expect(isFFLoaded()).toBe(false)

    // While loading is in flight, user triggers reset
    resetFfmpeg()

    // The stale load finally finishes
    finishLoad!()
    await expect(loadPromise).rejects.toThrow(/FFmpeg loading was cancelled/)

    // Stale instance must have been terminated and not marked loaded
    expect(mockGlobalFfInstance.terminate).toHaveBeenCalled()
    expect(isFFLoaded()).toBe(false)
  })

  it('18. loadFfmpeg resolves successfully when uncancelled', async () => {
    mockGlobalFfInstance.load.mockResolvedValueOnce(true)
    const ff = await loadFfmpeg()
    expect(ff).toBe(mockGlobalFfInstance)
    expect(isFFLoaded()).toBe(true)
  })

  it('19. old asynchronous load completing after newer load begins does not overwrite newer instance or loading promise', async () => {
    let finishLoad1: () => void
    const load1Deferred = new Promise<void>((resolve) => {
      finishLoad1 = resolve
    })

    let finishLoad2: () => void
    const load2Deferred = new Promise<void>((resolve) => {
      finishLoad2 = resolve
    })

    let loadCount = 0
    mockGlobalFfInstance.load.mockImplementation(async () => {
      loadCount++
      if (loadCount === 1) {
        await load1Deferred
      } else {
        await load2Deferred
      }
    })

    // Start load 1
    const loadPromise1 = loadFfmpeg()
    expect(isFFLoaded()).toBe(false)

    // User resets
    resetFfmpeg()

    // Start load 2
    const loadPromise2 = loadFfmpeg()
    expect(isFFLoaded()).toBe(false)

    // Old load 1 finishes late
    finishLoad1!()
    await expect(loadPromise1).rejects.toThrow(/FFmpeg loading was cancelled/)

    // Stale load 1 must NOT have marked isFFLoaded true or destroyed load 2's promise
    expect(isFFLoaded()).toBe(false)

    // New load 2 finishes
    finishLoad2!()
    const ff2 = await loadPromise2
    expect(ff2).toBe(mockGlobalFfInstance)
    expect(isFFLoaded()).toBe(true)
  })

  it('20. late-arriving MT CDN blob fetch after MT timeout revokes Blob URLs and skips ffMT.load', async () => {
    vi.useFakeTimers()
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    try {
      // @ts-expect-error test override
      globalThis.crossOriginIsolated = true
      // @ts-expect-error test override
      globalThis.SharedArrayBuffer = ArrayBuffer

      let resolveBlobUrls!: (urls: string[]) => void
      const blobPromise = new Promise<string[]>((resolve) => {
        resolveBlobUrls = resolve
      })

      mockToBlobURL.mockImplementation(async (url: string) => {
        const urls = await blobPromise
        if (url.includes('worker')) return urls[2]
        if (url.includes('wasm')) return urls[1]
        return urls[0]
      })

      mockGlobalFfInstance.load.mockResolvedValue(true)

      const loadPromise = loadFfmpeg()

      await vi.advanceTimersByTimeAsync(12_005)

      const ff = await loadPromise
      expect(ff).toBe(mockGlobalFfInstance)
      expect(isFFLoaded()).toBe(true)
      expect(isMtFailed()).toBe(true)

      expect(revokeSpy).not.toHaveBeenCalled()

      resolveBlobUrls(['blob:core-test-url', 'blob:wasm-test-url', 'blob:worker-test-url'])
      await vi.advanceTimersByTimeAsync(10)

      expect(revokeSpy).toHaveBeenCalledWith('blob:core-test-url')
      expect(revokeSpy).toHaveBeenCalledWith('blob:wasm-test-url')
      expect(revokeSpy).toHaveBeenCalledWith('blob:worker-test-url')

      expect(mockGlobalFfInstance.load).toHaveBeenCalledTimes(1)
      expect(mockGlobalFfInstance.load).toHaveBeenCalledWith({
        coreURL: expect.stringContaining('ffmpeg-core.js'),
        wasmURL: expect.stringContaining('ffmpeg-core.wasm'),
      })
    } finally {
      revokeSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('21. late-arriving ffMT.load completion after MT timeout revokes Blob URLs and terminates orphaned instance', async () => {
    vi.useFakeTimers()
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    try {
      // @ts-expect-error test override
      globalThis.crossOriginIsolated = true
      // @ts-expect-error test override
      globalThis.SharedArrayBuffer = ArrayBuffer

      mockToBlobURL.mockImplementation(async (url: string) => {
        if (url.includes('worker')) return 'blob:worker-mt-url'
        if (url.includes('wasm')) return 'blob:wasm-mt-url'
        return 'blob:core-mt-url'
      })

      let finishMtLoad!: () => void
      const mtLoadPromise = new Promise<void>((resolve) => {
        finishMtLoad = resolve
      })

      mockGlobalFfInstance.load.mockImplementation(async (config: any) => {
        if (config.workerURL) {
          await mtLoadPromise
        }
        return true
      })

      const loadPromise = loadFfmpeg()

      await vi.advanceTimersByTimeAsync(12_005)

      const ff = await loadPromise
      expect(ff).toBe(mockGlobalFfInstance)
      expect(isFFLoaded()).toBe(true)
      expect(isMtFailed()).toBe(true)

      expect(revokeSpy).toHaveBeenCalledWith('blob:core-mt-url')
      expect(revokeSpy).toHaveBeenCalledWith('blob:wasm-mt-url')
      expect(revokeSpy).toHaveBeenCalledWith('blob:worker-mt-url')

      expect(mockGlobalFfInstance.terminate).toHaveBeenCalled()

      finishMtLoad()
      await vi.advanceTimersByTimeAsync(10)

      expect(isFFLoaded()).toBe(true)
    } finally {
      revokeSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('22. ST load timeout terminates worker and throws helpful error', async () => {
    vi.useFakeTimers()
    try {
      mockGlobalFfInstance.load.mockImplementation(() => new Promise<never>(() => {}))

      const loadPromise = loadFfmpeg()
      const rejectionPromise = expect(loadPromise).rejects.toThrow(
        /Failed to load the video processing engine\. Check your internet connection and try again\. \(Engine load timed out/,
      )

      await vi.advanceTimersByTimeAsync(60_005)
      await rejectionPromise

      expect(mockGlobalFfInstance.terminate).toHaveBeenCalled()
      expect(isFFLoaded()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('23. MT partial-failure race: core JS succeeds, WASM fails, worker finishes late - all created Blob URLs are revoked', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    try {
      // @ts-expect-error test override
      globalThis.crossOriginIsolated = true
      // @ts-expect-error test override
      globalThis.SharedArrayBuffer = ArrayBuffer

      let resolveWorkerBlob!: (url: string) => void
      const workerBlobPromise = new Promise<string>((resolve) => {
        resolveWorkerBlob = resolve
      })

      mockToBlobURL.mockImplementation(async (url: string) => {
        if (url.includes('worker')) {
          return workerBlobPromise
        }
        if (url.includes('wasm')) {
          throw new Error('WASM network failure 500')
        }
        return 'blob:core-partial-success'
      })

      // ST fallback succeeds
      mockGlobalFfInstance.load.mockResolvedValue(true)

      // Start loading FFmpeg: MT starts, core succeeds, wasm throws, falls back to ST
      const loadPromise = loadFfmpeg()
      const ff = await loadPromise
      expect(ff).toBe(mockGlobalFfInstance)
      expect(isFFLoaded()).toBe(true)
      expect(isMtFailed()).toBe(true)

      // core-partial-success was captured and revoked during failure cleanup
      expect(revokeSpy).toHaveBeenCalledWith('blob:core-partial-success')
      expect(revokeSpy).not.toHaveBeenCalledWith('blob:worker-late-arrival')

      // Now the late worker fetch resolves after aggregate already rejected
      resolveWorkerBlob('blob:worker-late-arrival')
      await new Promise(r => setTimeout(r, 10))

      // The late-arriving worker Blob URL must be revoked immediately upon creation
      expect(revokeSpy).toHaveBeenCalledWith('blob:worker-late-arrival')
    } finally {
      revokeSpy.mockRestore()
    }
  })

  it('24. MT partial-failure race: first fetch fails immediately, other two fetches resolve late - late URLs are revoked', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    try {
      // @ts-expect-error test override
      globalThis.crossOriginIsolated = true
      // @ts-expect-error test override
      globalThis.SharedArrayBuffer = ArrayBuffer

      let resolveWasm!: (url: string) => void
      const wasmPromise = new Promise<string>((resolve) => {
        resolveWasm = resolve
      })

      let resolveWorker!: (url: string) => void
      const workerPromise = new Promise<string>((resolve) => {
        resolveWorker = resolve
      })

      mockToBlobURL.mockImplementation(async (url: string) => {
        if (url.includes('core.js')) {
          throw new Error('Core JS 404')
        }
        if (url.includes('wasm')) {
          return wasmPromise
        }
        return workerPromise
      })

      mockGlobalFfInstance.load.mockResolvedValue(true)

      const loadPromise = loadFfmpeg()
      const ff = await loadPromise
      expect(ff).toBe(mockGlobalFfInstance)
      expect(isFFLoaded()).toBe(true)
      expect(isMtFailed()).toBe(true)

      // Late fetches complete after MT has already fallen back to ST
      resolveWasm('blob:wasm-late-arrival')
      resolveWorker('blob:worker-late-arrival')
      await new Promise(r => setTimeout(r, 10))

      expect(revokeSpy).toHaveBeenCalledWith('blob:wasm-late-arrival')
      expect(revokeSpy).toHaveBeenCalledWith('blob:worker-late-arrival')
    } finally {
      revokeSpy.mockRestore()
    }
  })

  it('25. ST and MT timers are cleared upon successful load or failure without leaking into event loop', async () => {
    const clearTimerSpy = vi.spyOn(globalThis, 'clearTimeout')
    try {
      mockGlobalFfInstance.load.mockResolvedValue(true)

      // Successful ST load
      await loadFfmpeg()
      expect(isFFLoaded()).toBe(true)

      // Timer was cleared in finally block
      expect(clearTimerSpy).toHaveBeenCalled()
    } finally {
      clearTimerSpy.mockRestore()
    }
  })

  it('26. successful MT loading retains worker URL while revoking core and wasm URLs immediately', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    try {
      // @ts-expect-error test override
      globalThis.crossOriginIsolated = true
      // @ts-expect-error test override
      globalThis.SharedArrayBuffer = ArrayBuffer

      mockToBlobURL.mockImplementation(async (url: string) => {
        if (url.includes('worker')) return 'blob:worker-retained-url'
        if (url.includes('wasm')) return 'blob:wasm-freed-url'
        return 'blob:core-freed-url'
      })

      mockGlobalFfInstance.load.mockResolvedValue(true)

      const ff = await loadFfmpeg()
      expect(ff).toBe(mockGlobalFfInstance)
      expect(isFFLoaded()).toBe(true)
      expect(isMtFailed()).toBe(false)

      expect(revokeSpy).toHaveBeenCalledWith('blob:core-freed-url')
      expect(revokeSpy).toHaveBeenCalledWith('blob:wasm-freed-url')

      expect(revokeSpy).not.toHaveBeenCalledWith('blob:worker-retained-url')
      expect(getActiveWorkerBlobUrlForTesting()).toBe('blob:worker-retained-url')
    } finally {
      revokeSpy.mockRestore()
    }
  })

  it('27. resetFfmpeg revokes the retained worker URL', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    try {
      // @ts-expect-error test override
      globalThis.crossOriginIsolated = true
      // @ts-expect-error test override
      globalThis.SharedArrayBuffer = ArrayBuffer

      mockToBlobURL.mockImplementation(async (url: string) => {
        if (url.includes('worker')) return 'blob:worker-to-reset'
        return 'blob:other-url'
      })
      mockGlobalFfInstance.load.mockResolvedValue(true)

      await loadFfmpeg()
      expect(getActiveWorkerBlobUrlForTesting()).toBe('blob:worker-to-reset')

      resetFfmpeg()

      expect(revokeSpy).toHaveBeenCalledWith('blob:worker-to-reset')
      expect(getActiveWorkerBlobUrlForTesting()).toBeNull()
    } finally {
      revokeSpy.mockRestore()
    }
  })

  it('28. watchdog timeout revokes the retained worker URL', async () => {
    vi.useFakeTimers()
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    try {
      // @ts-expect-error test override
      globalThis.crossOriginIsolated = true
      // @ts-expect-error test override
      globalThis.SharedArrayBuffer = ArrayBuffer

      mockToBlobURL.mockImplementation(async (url: string) => {
        if (url.includes('worker')) return 'blob:worker-watchdog-target'
        return 'blob:other-url'
      })
      mockGlobalFfInstance.load.mockResolvedValue(true)

      await loadFfmpeg()
      expect(getActiveWorkerBlobUrlForTesting()).toBe('blob:worker-watchdog-target')

      const mockFf = createMockFf()
      mockFf.exec.mockImplementation(() => new Promise<never>(() => {}))

      const rejectionPromise = expect(
        runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-i', 'hang.mp4'], 10_000),
      ).rejects.toThrow()

      await vi.advanceTimersByTimeAsync(15_000)
      await rejectionPromise

      expect(revokeSpy).toHaveBeenCalledWith('blob:worker-watchdog-target')
      expect(getActiveWorkerBlobUrlForTesting()).toBeNull()
    } finally {
      revokeSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('29. health check failure revokes the retained worker URL', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    try {
      // @ts-expect-error test override
      globalThis.crossOriginIsolated = true
      // @ts-expect-error test override
      globalThis.SharedArrayBuffer = ArrayBuffer

      mockToBlobURL.mockImplementation(async (url: string) => {
        if (url.includes('worker')) return 'blob:worker-health-target'
        return 'blob:other-url'
      })
      mockGlobalFfInstance.load.mockResolvedValue(true)

      await loadFfmpeg()
      expect(getActiveWorkerBlobUrlForTesting()).toBe('blob:worker-health-target')

      const mockFf = createMockFf()
      mockFf.exec.mockImplementation(async () => {
        throw new Error('Fatal worker crash')
      })

      await expect(
        runFfmpegWithWatchdog(mockFf as unknown as FFmpeg, ['-i', 'crash.mp4']),
      ).rejects.toThrow(/Fatal worker crash/)

      expect(revokeSpy).toHaveBeenCalledWith('blob:worker-health-target')
      expect(getActiveWorkerBlobUrlForTesting()).toBeNull()
    } finally {
      revokeSpy.mockRestore()
    }
  })
})
