import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { loudnormFilter, type LoudnessTarget } from './loudness'
import type { SilenceSegment } from './silenceCutter'
import type { BlurRegion } from '../components/FaceBlurPanel'
import { checkWebCodecsAvailable, checkFileDecodable, isWebCodecsViable, exportVideoWebCodecs } from './webcodecs'
import type { WatermarkPosition } from '../components/WatermarkPanel'

const CDN_SINGLE        = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm'
const CDN_MT            = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/esm'
const LOAD_TIMEOUT_MS   = 60_000
const MT_LOAD_TIMEOUT_MS = 12_000

let _ff:             FFmpeg | null          = null
let _loaded:         boolean                = false
let _loadingPromise: Promise<FFmpeg> | null = null
let _mtFailed        = false  // set true if MT core loading fails or times out; not reset
// Set true when an unrecoverable worker-level failure occurs (e.g. watchdog timeout
// or genuine worker crash failing health check). loadFfmpeg() checks this flag and discards
// the dead instance before returning a fresh one.
let _workerAborted   = false
// Monotonic generation counter incremented on instance reload or resetFfmpeg().
// Allows in-flight operations to distinguish intentional resets from unprompted crashes.
let _instanceGeneration = 0

// Retained worker URL for the active multi-threaded FFmpeg instance.
// Emscripten allocates pthread workers from this URL. Retained until the instance is terminated.
let _activeWorkerBlobURL: string | null = null

// Ownership lease for the FFmpeg task lock.
// Using a unique symbol lease prevents stale finally blocks from releasing
// a lock acquired by a newer operation after an intentional reset.
export type FfmpegLockLease = symbol
let _activeLockLease: FfmpegLockLease | null = null

// Custom error class distinguishing watchdog timeouts from operational errors.
export class WatchdogTimeoutError extends Error {
  readonly isWatchdogTimeout = true
  constructor(message: string) {
    super(message)
    this.name = 'WatchdogTimeoutError'
  }
}

const HEALTH_CHECK_TIMEOUT_MS = 3_000

function isWatchdogError(err: unknown): boolean {
  if (err instanceof WatchdogTimeoutError) return true
  if (err && typeof err === 'object' && ('isWatchdogTimeout' in err || (err as Error).name === 'WatchdogTimeoutError')) {
    return true
  }
  return false
}

function isTerminationError(raw: unknown): boolean {
  if (!raw) return false
  if (raw instanceof Error && (raw.message.includes('called FFmpeg.terminate()') || raw.name === 'AbortError')) {
    return true
  }
  if (typeof raw === 'string' && raw.includes('called FFmpeg.terminate()')) {
    return true
  }
  return false
}

function normalizeError(raw: unknown, defaultMsg = 'FFmpeg threw an unexpected internal error.'): Error {
  if (raw instanceof Error) return raw
  if (typeof raw === 'string') return new Error(raw)
  return new Error(defaultMsg)
}

// Perform a bounded health verification check on an existing FFmpeg instance.
// Executes a benign -version check directly on the worker without recursing into watchdog.
export async function verifyFfmpegHealth(ff: FFmpeg): Promise<boolean> {
  if (!ff || !ff.loaded) {
    return false
  }

  let timer: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), HEALTH_CHECK_TIMEOUT_MS)
  })

  const execPromise = (async () => {
    try {
      const ret = await ff.exec(['-version'])
      return ret === 0
    } catch {
      return false
    }
  })()

  try {
    return await Promise.race([execPromise, timeoutPromise])
  } catch {
    return false
  } finally {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
}

// Minimum stale-activity timeout regardless of clip length.
const EXEC_STALE_FLOOR_MS = 3 * 60 * 1000

// Compute a duration-scaled stale-activity timeout for execOrThrow.
// The floor (3 min) covers short clips and initial WASM startup. We add
// 1 extra minute per minute of clip (ceil) so that on slow hardware
// (VP9 at 1080p, complex filter graphs) the watchdog does not fire
// prematurely during a legitimate encode that has not yet emitted a
// progress event. Capped at 20 minutes.
function calcStaleMs(durationSec: number): number {
  const extraMinutes = Math.ceil(durationSec / 60)
  return Math.min(20 * 60 * 1000, EXEC_STALE_FLOOR_MS + extraMinutes * 60 * 1000)
}

// Watchdog timeouts:
// 1. Silent worker watchdog: fires when NO log or progress event occurs for staleMs window.
// 2. Progress stall watchdog (for operations that expect progress, e.g. video encodes):
//    - Startup grace period (PROGRESS_STARTUP_GRACE_MS): fires when FFmpeg logs but emits no
//      valid progress for 2 minutes (catches infinite filter loops like loudnorm with unknown duration).
//    - Ongoing progress stall (PROGRESS_STALE_MS): fires when progress stops advancing for 2 minutes
//      mid-encode (catches frozen encoding threads while logging threads continue).
const PROGRESS_STARTUP_GRACE_MS = 2 * 60_000 // 2 min grace period before first progress
const PROGRESS_STALE_MS         = 2 * 60_000 // 2 min without progress advancing once started
const WATCHDOG_CHECK_INTERVAL_MS = 5_000     // check watchdogs every 5 seconds

export interface RunFfmpegOptions {
  staleMs?: number
  onFirstLog?: () => void
  expectsProgress?: boolean
  progressStaleMs?: number
  startupGraceMs?: number
}

export async function runFfmpegWithWatchdog(
  ff: FFmpeg,
  args: string[],
  staleMsOrOptions: number | RunFfmpegOptions = EXEC_STALE_FLOOR_MS,
  onFirstLog?: () => void,
  expectsProgressParam?: boolean,
): Promise<void> {
  let staleMs = EXEC_STALE_FLOOR_MS
  let onFirstLogCb = onFirstLog
  let expectsProgress = false
  let progressStaleMs = PROGRESS_STALE_MS
  let startupGraceMs = PROGRESS_STARTUP_GRACE_MS

  if (typeof staleMsOrOptions === 'object' && staleMsOrOptions !== null) {
    if (staleMsOrOptions.staleMs !== undefined) staleMs = staleMsOrOptions.staleMs
    if (staleMsOrOptions.onFirstLog !== undefined) onFirstLogCb = staleMsOrOptions.onFirstLog
    if (staleMsOrOptions.expectsProgress !== undefined) expectsProgress = staleMsOrOptions.expectsProgress
    if (staleMsOrOptions.progressStaleMs !== undefined) progressStaleMs = staleMsOrOptions.progressStaleMs
    if (staleMsOrOptions.startupGraceMs !== undefined) startupGraceMs = staleMsOrOptions.startupGraceMs
  } else {
    if (typeof staleMsOrOptions === 'number') staleMs = staleMsOrOptions
    if (expectsProgressParam !== undefined) expectsProgress = expectsProgressParam
  }

  const opGen = _instanceGeneration
  const logLines: string[] = []
  let lastActivityMs        = Date.now()
  let firstLogMs            = 0      // when the first log line arrived
  let firstLogFired         = false
  let lastProgressValue     = -1
  let lastProgressAdvanceMs = 0      // when progress last advanced forward

  const logHandler = ({ message }: { message: string }) => {
    logLines.push(message)
    lastActivityMs = Date.now()
    if (!firstLogFired) {
      firstLogFired  = true
      firstLogMs     = Date.now()
      onFirstLogCb?.()
    }
  }
  const progressActivityHandler = ({ progress }: { progress: number }) => {
    lastActivityMs = Date.now()
    if (isFinite(progress) && progress >= 0) {
      if (progress > lastProgressValue) {
        lastProgressValue = progress
        lastProgressAdvanceMs = Date.now()
      }
    }
  }

  ff.on('log',      logHandler)
  ff.on('progress', progressActivityHandler)

  let staleTimer: ReturnType<typeof setInterval> | null = null

  const stalePromise = new Promise<never>((_, reject) => {
    staleTimer = setInterval(() => {
      const now = Date.now()

      // Watchdog 1: completely silent worker.
      if (now - lastActivityMs > staleMs) {
        clearInterval(staleTimer!)
        staleTimer = null
        const staleMinutes = Math.round(staleMs / 60_000)
        reject(new WatchdogTimeoutError(
          `The video processing engine stopped responding (no activity for ${staleMinutes} minutes). ` +
          'Try a shorter clip, lower quality, or turning off audio filters.'
        ))
        return
      }

      // Watchdog 2: progress monitoring for operations that produce progress.
      if (expectsProgress) {
        // Phase 2A: initial startup grace period before first progress advancement
        if (
          firstLogMs > 0 &&
          lastProgressAdvanceMs === 0 &&
          now - firstLogMs > startupGraceMs
        ) {
          clearInterval(staleTimer!)
          staleTimer = null
          reject(new WatchdogTimeoutError(
            'The export started but produced no output frames for 2 minutes. ' +
            'Try turning off loudness normalization, or use a shorter clip.'
          ))
          return
        }

        // Phase 2B: ongoing progress advancement stall
        if (
          lastProgressAdvanceMs > 0 &&
          lastProgressValue < 1.0 &&
          now - lastProgressAdvanceMs > progressStaleMs
        ) {
          clearInterval(staleTimer!)
          staleTimer = null
          reject(new WatchdogTimeoutError(
            'The export stalled and made no progress for 2 minutes. ' +
            'Try a shorter clip or lower quality.'
          ))
          return
        }
      }
    }, WATCHDOG_CHECK_INTERVAL_MS)
  })

  let ret: number
  try {
    ret = (await Promise.race([ff.exec(args), stalePromise])) as number
  } catch (raw) {
    // 1. Intentional cancellation / reset check before health probe:
    // If resetFfmpeg() was called during this operation, do not treat as an engine failure.
    if (_instanceGeneration !== opGen || isTerminationError(raw)) {
      throw normalizeError(raw, 'Operation was cancelled.')
    }

    // 2. Watchdog timeout check:
    // Watchdog indicates an unresponsive worker. Terminate immediately and mark for reload.
    if (isWatchdogError(raw)) {
      _workerAborted = true
      if (_activeWorkerBlobURL) {
        try { URL.revokeObjectURL(_activeWorkerBlobURL) } catch { /* ignore */ }
        _activeWorkerBlobURL = null
      }
      try { ff.terminate() } catch { /* ignore */ }
      const msg = raw instanceof Error ? raw.message : String(raw)
      throw new Error(msg)
    }

    // 3. Operation-level rejection (e.g. FFMessageType.ERROR from worker):
    // Test worker health before deciding whether it died.
    const isHealthy = await verifyFfmpegHealth(ff)

    // Re-check generation immediately after health check:
    // If resetFfmpeg() or reload occurred while verifyFfmpegHealth was awaiting,
    // this operation is stale and must not mark the new instance aborted or terminate it.
    if (_instanceGeneration !== opGen) {
      throw normalizeError(raw, 'Operation was cancelled.')
    }

    if (isHealthy) {
      console.log('[CalmClip] FFmpeg operation rejected, but worker passed health verification. Preserving worker.')
      throw normalizeError(raw)
    }

    // 4. Health check failed or timed out: instance is genuinely unrecoverable.
    console.log('[CalmClip] FFmpeg worker failed health verification, terminating instance for reload.')
    _workerAborted = true
    if (_activeWorkerBlobURL) {
      try { URL.revokeObjectURL(_activeWorkerBlobURL) } catch { /* ignore */ }
      _activeWorkerBlobURL = null
    }
    try { ff.terminate() } catch { /* ignore */ }
    throw normalizeError(raw)
  } finally {
    if (staleTimer !== null) { clearInterval(staleTimer); staleTimer = null }
    ff.off('log',      logHandler)
    ff.off('progress', progressActivityHandler)
  }
  // Note: Emscripten runtime exit unwinds via abort(""), printing "Aborted()" to
  // stderr before exec() returns exit code 0. ffmpeg-core's exec() wrapper catches
  // this exit and returns code 0 normally. Therefore, "Aborted()" appearing in logs
  // during a successful exit (ret === 0) is benign completion output, not a worker
  // failure, and must not trigger worker destruction or instance reload.
  if (ret! !== 0) {
    const tail = logLines.slice(-30).join('\n').trim()
    const detail = tail ? `\n\nFFmpeg log (last 30 lines):\n${tail}` : ''
    throw new Error(
      `FFmpeg exited with code ${ret!}. The video could not be processed. This may be caused by an unsupported codec, an invalid filter expression, or insufficient memory.${detail}`
    )
  }
}

// Validates an assembled FFmpeg filter string before passing it to exec.
// Catches construction errors that would produce a cryptic exit-code-1 from FFmpeg:
//   Unbalanced single quotes (a sign that text escaping went wrong in a filter value).
// Throws an explicit Error so the export path surfaces the problem before FFmpeg runs.
function validateFilterExpr(filter: string, context: string): void {
  let inQuote = false
  for (let i = 0; i < filter.length; i++) {
    // A ' preceded by \ is a level-1 backslash-escaped literal, not a quote delimiter.
    if (filter[i] === "'" && filter[i - 1] !== '\\') {
      inQuote = !inQuote
    }
  }
  if (inQuote) {
    throw new Error(
      `Filter error (${context}): the generated filter string has unbalanced single quotes. ` +
      `A filter value may contain a character that disrupted quoting. ` +
      `Check for apostrophes or unusual punctuation in any text fields.`
    )
  }
}

export async function loadFfmpeg(): Promise<FFmpeg> {
  // If the previous exec suffered an unrecoverable failure (watchdog timeout or
  // worker-level rejection), _workerAborted is set.
  // Discard the cached instance so the code below loads a fresh one.
  // Also mark MT as failed: the shared pthreads environment has residual state
  // that causes a fresh MT reload to deadlock mid-exec. The single-threaded
  // core is stable after an MT crash and handles all the same filters.
  if (_workerAborted) {
    console.log('[CalmClip] loadFfmpeg: discarding dead WASM instance (unrecoverable error detected), reloading with ST core')
    _instanceGeneration++
    if (_activeWorkerBlobURL) {
      try { URL.revokeObjectURL(_activeWorkerBlobURL) } catch { /* ignore */ }
      _activeWorkerBlobURL = null
    }
    if (_ff) { try { _ff.terminate() } catch { /* ignore */ } }
    _ff             = null
    _loaded         = false
    _loadingPromise = null
    _workerAborted  = false
    _mtFailed       = true
  }
  if (_ff && _loaded) return _ff
  if (_loadingPromise) return _loadingPromise

  const loadGen = _instanceGeneration
  const currentPromise = (async () => {
    // Try multi-threaded core first when SharedArrayBuffer is available.
    // toBlobURL converts CDN URLs to same-origin blob: URLs so the Emscripten
    // worker thread can load them in a cross-origin-isolated context.
    const canTryMT = !_mtFailed
      && typeof SharedArrayBuffer !== 'undefined'
      && typeof crossOriginIsolated !== 'undefined'
      && crossOriginIsolated

    if (canTryMT) {
      const ffMT = new FFmpeg()
      const trackedBlobURLs = new Set<string>()
      let mtAbandoned = false

      const safelyRevokeBlobUrl = (url: string | null | undefined): void => {
        if (!url) return
        trackedBlobURLs.delete(url)
        try { URL.revokeObjectURL(url) } catch { /* ignore */ }
      }

      const revokeAllTrackedBlobUrls = (): void => {
        for (const url of trackedBlobURLs) {
          try { URL.revokeObjectURL(url) } catch { /* ignore */ }
        }
        trackedBlobURLs.clear()
      }

      const fetchTrackedBlobUrl = async (url: string, mime: string): Promise<string> => {
        const blobUrl = await toBlobURL(url, mime)
        // If MT loading was abandoned or instance generation changed while the fetch was in flight,
        // revoke the newly created object URL immediately.
        if (mtAbandoned || _instanceGeneration !== loadGen) {
          safelyRevokeBlobUrl(blobUrl)
          throw new Error('MT load abandoned')
        }
        trackedBlobURLs.add(blobUrl)
        return blobUrl
      }

      let mtTimer: ReturnType<typeof setTimeout> | null = null
      let loadedWorkerBlobUrl: string | null = null
      try {
        // The timeout covers the toBlobURL fetches as well as ffMT.load().
        await Promise.race([
          (async () => {
            const [coreURL, wasmURL, workerURL] = await Promise.all([
              fetchTrackedBlobUrl(`${CDN_MT}/ffmpeg-core.js`,        'text/javascript'),
              fetchTrackedBlobUrl(`${CDN_MT}/ffmpeg-core.wasm`,      'application/wasm'),
              fetchTrackedBlobUrl(`${CDN_MT}/ffmpeg-core.worker.js`, 'text/javascript'),
            ])
            loadedWorkerBlobUrl = workerURL

            if (mtAbandoned || _instanceGeneration !== loadGen) {
              revokeAllTrackedBlobUrls()
              try { ffMT.terminate() } catch { /* ignore */ }
              return
            }

            await ffMT.load({ coreURL, wasmURL, workerURL })

            // If timeout or reset fired while ffMT.load was in-flight, clean up immediately
            if (mtAbandoned || _instanceGeneration !== loadGen) {
              revokeAllTrackedBlobUrls()
              try { ffMT.terminate() } catch { /* ignore */ }
              return
            }
          })(),
          new Promise<never>((_, reject) => {
            mtTimer = setTimeout(() => reject(new Error('MT timeout')), MT_LOAD_TIMEOUT_MS)
          }),
        ])

        // Revoke coreURL and wasmURL immediately after successful load:
        // wasmURL is 7.3 MB and has already been compiled into WebAssembly.Module.
        // Retain workerURL for the lifetime of this ffMT instance so dynamic pthread creation succeeds.
        if (loadedWorkerBlobUrl) {
          if (_activeWorkerBlobURL && _activeWorkerBlobURL !== loadedWorkerBlobUrl) {
            try { URL.revokeObjectURL(_activeWorkerBlobURL) } catch { /* ignore */ }
          }
          _activeWorkerBlobURL = loadedWorkerBlobUrl
          trackedBlobURLs.delete(loadedWorkerBlobUrl)
        }
        revokeAllTrackedBlobUrls()

        // Generation check: if reset occurred while loading, discard this instance
        if (_instanceGeneration !== loadGen) {
          if (_activeWorkerBlobURL) {
            try { URL.revokeObjectURL(_activeWorkerBlobURL) } catch { /* ignore */ }
            _activeWorkerBlobURL = null
          }
          try { ffMT.terminate() } catch { /* ignore */ }
          throw new Error('FFmpeg loading was cancelled.')
        }

        _ff             = ffMT
        _loaded         = true
        return ffMT
      } catch (err) {
        mtAbandoned = true
        revokeAllTrackedBlobUrls()
        if (_activeWorkerBlobURL) {
          try { URL.revokeObjectURL(_activeWorkerBlobURL) } catch { /* ignore */ }
          _activeWorkerBlobURL = null
        }
        try { ffMT.terminate() } catch { /* ignore */ }

        if (_instanceGeneration !== loadGen) {
          throw normalizeError(err, 'FFmpeg loading was cancelled.')
        }

        _mtFailed = true
        // Fall through to single-threaded core
      } finally {
        if (mtTimer !== null) {
          clearTimeout(mtTimer)
          mtTimer = null
        }
      }
    }

    // Single-threaded core: universal fallback
    const ffST = new FFmpeg()
    let stTimer: ReturnType<typeof setTimeout> | null = null
    try {
      await Promise.race([
        ffST.load({
          coreURL: `${CDN_SINGLE}/ffmpeg-core.js`,
          wasmURL: `${CDN_SINGLE}/ffmpeg-core.wasm`,
        }),
        new Promise<never>((_, reject) => {
          stTimer = setTimeout(
            () => reject(new Error('Engine load timed out after 60 seconds. Check your internet connection and try again.')),
            LOAD_TIMEOUT_MS,
          )
        }),
      ])
    } catch (e) {
      if (_instanceGeneration === loadGen) {
        _ff             = null
        _loaded         = false
      }
      try { ffST.terminate() } catch { /* ignore */ }
      if (_instanceGeneration !== loadGen) {
        throw normalizeError(e, 'FFmpeg loading was cancelled.')
      }
      const cause = e instanceof Error ? e.message : String(e)
      throw new Error(
        `Failed to load the video processing engine. Check your internet connection and try again. (${cause})`
      )
    } finally {
      if (stTimer !== null) {
        clearTimeout(stTimer)
        stTimer = null
      }
    }

    // Generation check before committing ST instance
    if (_instanceGeneration !== loadGen) {
      try { ffST.terminate() } catch { /* ignore */ }
      throw new Error('FFmpeg loading was cancelled.')
    }

    _ff             = ffST
    _loaded         = true
    return ffST
  })().finally(() => {
    if (_loadingPromise === currentPromise) {
      _loadingPromise = null
    }
  })

  _loadingPromise = currentPromise
  return _loadingPromise
}

// Returns true if the FFmpeg WASM core has already been loaded this session.
// Used by the UI to skip the first-load download notice on subsequent file loads.
export function isFFLoaded(): boolean {
  return _loaded
}

// Returns true if an exec() is currently in progress.
// Other features must not call ff.exec() concurrently with an export: the
// WASM singleton is not re-entrant and two simultaneous exec() calls deadlock.
export function isFFmpegBusy(): boolean {
  return _activeLockLease !== null
}

// Acquire the lock before starting an FFmpeg task. Throws if busy.
// Returns an ownership lease that must be provided to releaseFfmpegLock.
export function acquireFfmpegLock(): FfmpegLockLease {
  if (_activeLockLease !== null) {
    throw new Error('A video processing task is in progress. Please wait for it to finish first.')
  }
  const lease = Symbol('ffmpeg-lock')
  _activeLockLease = lease
  return lease
}

// Wait for another local FFmpeg operation to finish before starting a task.
// Canvas export uses this at finalization so a concurrent analysis cannot make
// an otherwise-complete export fail at the last step.
export async function waitForFfmpegAvailable(timeoutMs = 5 * 60_000): Promise<void> {
  const startedAt = Date.now()
  while (isFFmpegBusy()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error('Another video processing task is still running. Export could not remove metadata safely; wait for it to finish and retry.')
    }
    await new Promise<void>(resolve => setTimeout(resolve, 100))
  }
}

// Release the FFmpeg task lock.
// A mandatory lease token must be provided. Only releases if the lease matches the active lock,
// preventing stale finally blocks or unauthenticated calls from clearing a lock held by an operation.
export function releaseFfmpegLock(lease: FfmpegLockLease): void {
  if (_activeLockLease === lease) {
    _activeLockLease = null
  }
}

// Terminates the FFmpeg worker and clears the singleton cache.
// Call this after a crash or a user-initiated cancel so the next export
// starts with a fresh instance rather than a broken or missing one.
export function resetFfmpeg(): void {
  _instanceGeneration++
  if (_activeWorkerBlobURL) {
    try { URL.revokeObjectURL(_activeWorkerBlobURL) } catch { /* ignore */ }
    _activeWorkerBlobURL = null
  }
  if (_ff) {
    try { _ff.terminate() } catch { /* ignore */ }
  }
  _ff              = null
  _loaded          = false
  _loadingPromise  = null
  _workerAborted   = false
  _activeLockLease = null
}

export function getActiveWorkerBlobUrlForTesting(): string | null {
  return _activeWorkerBlobURL
}

export function isWorkerAborted(): boolean {
  return _workerAborted
}

export function isMtFailed(): boolean {
  return _mtFailed
}

export function resetMtFailedForTests(): void {
  _mtFailed = false
}

export function getFfmpegGeneration(): number {
  return _instanceGeneration
}

export { fetchFile }

export async function stripMetadataFromWebm(blob: Blob): Promise<Blob> {
  await waitForFfmpegAvailable()
  const lockLease = acquireFfmpegLock()
  const inputName  = 'sanitize-input.webm'
  const outputName = 'sanitize-output.webm'

  try {
    const ff = await loadFfmpeg()
    await ff.writeFile(inputName, await fetchFile(blob))
    await runFfmpegWithWatchdog(ff, [
      '-fflags', '+genpts',
      '-i', inputName,
      '-map', '0',
      '-c', 'copy',
      '-map_metadata', '-1',
      '-map_chapters', '-1',
      '-y', outputName,
    ])

    const result = await ff.readFile(outputName) as Uint8Array
    if (!result || result.byteLength === 0) {
      throw new Error('Metadata stripping produced an empty video. The export cannot be downloaded safely.')
    }
    const copy = new Uint8Array(result.byteLength)
    copy.set(result)
    return new Blob([copy.buffer], { type: 'video/webm' })
  } finally {
    try {
      const ff = _ff
      if (ff) {
        ff.deleteFile(inputName).catch(() => {})
        ff.deleteFile(outputName).catch(() => {})
      }
    } finally {
      releaseFfmpegLock(lockLease)
    }
  }
}

export type Ratio         = '16:9' | '9:16' | '1:1' | '4:5'
export type CropMode      = 'fit' | 'fill'
export type OutputQuality = '720p' | '1080p'
export type OutputFormat  = 'mp4' | 'webm' | 'mov'

const RATIO_DIMS_720: Record<Ratio, [number, number]> = {
  '16:9': [1280, 720],
  '9:16': [720, 1280],
  '1:1':  [720, 720],
  '4:5':  [720, 900],
}

const RATIO_DIMS_1080: Record<Ratio, [number, number]> = {
  '16:9': [1920, 1080],
  '9:16': [1080, 1920],
  '1:1':  [1080, 1080],
  '4:5':  [1080, 1350],
}

export function getRatioDims(ratio: Ratio, quality: OutputQuality): [number, number] {
  return quality === '1080p' ? RATIO_DIMS_1080[ratio] : RATIO_DIMS_720[ratio]
}

export const RATIO_SLUG: Record<Ratio, string> = {
  '16:9': '16x9',
  '9:16': '9x16',
  '1:1':  '1x1',
  '4:5':  '4x5',
}

function buildAudioFilter(loudnessTarget: LoudnessTarget, denoiseAudio: boolean): string | null {
  const loud  = loudnormFilter(loudnessTarget)
  const parts = [
    // afftdn with tn=1 (real-time noise tracking) does NOT require a large
    // look-ahead buffer: it estimates the noise floor continuously from
    // incoming audio, so the muxer sync issue that affects the two-pass loudnorm
    // filter does not apply here. nr=12 gives moderate reduction (12 dB) that
    // removes hiss, fans, and AC noise without audible artefacts on speech.
    // nf=-25 sets the noise floor threshold; content above this is treated as
    // signal and left alone. The highpass pre-filter removes sub-80 Hz handling
    // rumble before afftdn sees the signal, improving noise floor estimation.
    ...(denoiseAudio ? ['highpass=f=80', 'afftdn=nr=12:nf=-25:tn=1'] : []),
    ...(loud         ? [loud]                                         : []),
  ]
  return parts.length > 0 ? parts.join(',') : null
}

function buildScaleFilter(outW: number, outH: number, cropMode: CropMode): string {
  if (cropMode === 'fill') {
    return `scale=${outW}:${outH}:force_original_aspect_ratio=increase,crop=${outW}:${outH}`
  }
  return `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:color=black`
}

// Build a chained split/crop/gblur/overlay graph for region-limited blurring.
// For each region: split current frame into two copies, crop and blur one copy,
// then overlay the blurred region back onto the other copy at the same position.
// segIdx is used to create unique filter labels when called once per silence segment.
function buildBlurChain(
  inputLabel: string,
  regions: BlurRegion[],
  outW: number,
  outH: number,
  segIdx = 0,
): { parts: string[]; outputLabel: string } {
  if (regions.length === 0) return { parts: [], outputLabel: inputLabel }

  const parts: string[] = []
  let cur = inputLabel

  regions.forEach((r, ri) => {
    let x   = Math.round((r.x / 100) * outW)
    let y   = Math.round((r.y / 100) * outH)
    let w   = Math.max(2, Math.round((r.w / 100) * outW))
    let h   = Math.max(2, Math.round((r.h / 100) * outH))

    // Clamp coordinates and size to avoid FFmpeg crop filter out-of-boundary crash
    x = Math.max(0, Math.min(x, outW - 2))
    y = Math.max(0, Math.min(y, outH - 2))
    w = Math.max(2, Math.min(w, outW - x))
    h = Math.max(2, Math.min(h, outH - y))

    const pfx = `s${segIdx}r${ri}`
    const mn  = `${pfx}m`
    const sc  = `${pfx}c`
    const bl  = `${pfx}b`
    const ov  = `${pfx}v`

    parts.push(`[${cur}]split[${mn}][${sc}]`)
    parts.push(`[${sc}]crop=${w}:${h}:${x}:${y},gblur=sigma=15[${bl}]`)
    parts.push(`[${mn}][${bl}]overlay=${x}:${y}[${ov}]`)
    cur = ov
  })

  return { parts, outputLabel: cur }
}

// Compute which time segments to keep given a sorted list of cut segments.
// Cut segment timestamps are relative to trimStart; outputs are absolute.
export function computeKeepSegments(
  cuts: SilenceSegment[],
  trimStart: number,
  trimEnd: number,
): [number, number][] {
  const keep: [number, number][] = []
  let cursor = trimStart
  for (const s of cuts) {
    const absStart = trimStart + s.start
    const absEnd   = trimStart + s.end
    if (absStart > cursor + 0.05) keep.push([cursor, absStart])
    cursor = Math.max(cursor, absEnd)
  }
  if (cursor < trimEnd - 0.05) keep.push([cursor, trimEnd])
  return keep
}

export interface WatermarkOpts {
  file:     File
  position: WatermarkPosition
  opacity:  number
  scale:    number
  margin:   number
}

export interface ExportOptions {
  file:            File
  trimStart:       number
  trimEnd:         number
  ratio:           Ratio
  quality:         OutputQuality
  outputFormat?:   OutputFormat
  cropMode:        CropMode
  loudnessTarget:  LoudnessTarget
  denoiseAudio?:   boolean
  stripMetadata:   boolean
  silenceSegments: SilenceSegment[]
  removeSilence:   boolean
  blurRegions:     BlurRegion[]
  hasAudio:        boolean
  watermark?:      WatermarkOpts
  manualCuts?:     SilenceSegment[]
  sourceDims?:     [number, number]
  // When true, skip the WebCodecs hardware path entirely.
  skipWebCodecs?:  boolean
  onProgress:      (pct: number) => void
  onPhase?:        (label: string) => void
}

const WM_FILE = 'watermark.png'

// Returns the video + audio codec args for a given output format.
// MP4 and MOV both use H.264/AAC in a QuickTime-compatible container.
// WebM uses VP9/Opus, which are royalty-free and natively supported in all
// modern browsers. audioFilter is appended after -af only when non-empty.
//
// omitFastStart: when true, skips -movflags +faststart for MP4/MOV.
// The faststart second pass (moov relocation) triggers MT pthread teardown in
// the WASM core and kills the worker before readFile() can complete, causing
// the export to hang at 99%. Paths that use the concat-demuxer
// must omit faststart; moov-at-tail is valid for direct download and all major
// upload platforms re-process the container on ingest.
function codecArgs(
  format: OutputFormat,
  hasAudio: boolean,
  audioFilter: string | null,
  omitFastStart = false,
): string[] {
  const args: string[] = []
  if (format === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-crf', '33', '-b:v', '0')
    if (hasAudio) {
      args.push('-c:a', 'libopus', '-b:a', '128k')
      if (audioFilter) args.push('-af', audioFilter)
    } else {
      args.push('-an')
    }
  } else {
    args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23')
    if (hasAudio) {
      args.push('-c:a', 'aac', '-b:a', '128k')
      if (audioFilter) args.push('-af', audioFilter)
    } else {
      args.push('-an')
    }
    if (!omitFastStart) args.push('-movflags', '+faststart')
  }
  return args
}

function wmPosExpr(pos: WatermarkPosition, margin: number, outH: number): string {
  const m = Math.round(margin * outH / 720)
  switch (pos) {
    case 'top-left':     return `${m}:${m}`
    case 'top-right':    return `W-w-${m}:${m}`
    case 'bottom-left':  return `${m}:H-h-${m}`
    case 'bottom-right': return `W-w-${m}:H-h-${m}`
    case 'center':       return '(W-w)/2:(H-h)/2'
  }
}

function buildWmChain(
  inputLabel: string,
  wmInputIdx: number,
  outW: number,
  outH: number,
  wm: WatermarkOpts,
  labelSuffix = '',
): { parts: string[]; outputLabel: string } {
  const wPx      = Math.max(10, Math.round(outW * wm.scale / 100))
  const pos      = wmPosExpr(wm.position, wm.margin ?? 10, outH)
  const wmLabel  = `wm${labelSuffix}`
  const outLabel = `wmv${labelSuffix}`
  const parts = [
    `[${wmInputIdx}:v]scale=${wPx}:-1:flags=lanczos,format=rgba,colorchannelmixer=aa=${wm.opacity.toFixed(2)}[${wmLabel}]`,
    `[${inputLabel}][${wmLabel}]overlay=${pos}:format=auto[${outLabel}]`,
  ]
  return { parts, outputLabel: outLabel }
}

// Tier 2: Instant trim via FFmpeg stream copy (no video re-encode).
// Valid only when there are no video filters and the source dimensions already
// match the requested output dimensions, so no scaling is needed.
// Audio is still decoded/re-encoded if an audio filter is active.
async function exportVideoStreamCopy(ff: FFmpeg, opts: ExportOptions): Promise<Uint8Array> {
  const {
    file, trimStart, trimEnd, hasAudio, loudnessTarget, denoiseAudio,
    stripMetadata, outputFormat = 'mp4', onProgress, onPhase,
  } = opts

  onPhase?.('Exporting video...')

  const progressHandler = ({ progress }: { progress: number }) => {
    if (!isFinite(progress) || progress < 0) return
    onProgress(Math.min(Math.round(progress * 100), 99))
  }
  ff.on('progress', progressHandler)

  const inputName   = 'input.mp4'
  const outputName  = `output.${outputFormat}`
  const duration    = trimEnd - trimStart
  const audioFilter = buildAudioFilter(loudnessTarget, denoiseAudio ?? false)

  try {
    await ff.writeFile(inputName, await fetchFile(file))

    const args: string[] = [
      '-ss', String(trimStart),
      '-t',  String(duration),
      '-i',  inputName,
      '-c:v', 'copy',
    ]

    if (!hasAudio) {
      args.push('-an')
    } else if (audioFilter) {
      args.push('-c:a', 'aac', '-b:a', '128k', '-af', audioFilter)
    } else {
      args.push('-c:a', 'copy')
    }

    if (stripMetadata) args.push('-map_metadata', '-1')
    // Stream copy intentionally omits +faststart. The moov-relocation second pass
    // triggers pthread teardown in the MT WASM core and fires Aborted() after the
    // file is fully written, killing the WASM instance before we can read the VFS.
    // Stream-copied files are downloaded directly by the user; moov-at-tail is
    // valid and platforms re-process the container on upload.
    args.push('-avoid_negative_ts', 'make_zero', '-y', outputName)

    await runFfmpegWithWatchdog(ff, args, calcStaleMs(duration))
    // FFmpeg stops emitting progress events during the final muxing/container-write
    // phase. Push to 99 % immediately after exec so the bar advances even if the
    // last reported value was lower (e.g. 45 %).
    onProgress(99)

    const result = await ff.readFile(outputName) as Uint8Array
    if (!result?.byteLength) {
      throw new Error('Stream copy produced empty output. The source may be in an unsupported format.')
    }
    return result
  } finally {
    ff.off('progress', progressHandler)
    // Fire-and-forget: do NOT await deleteFile. After exec() the MT pthreads
    // runtime may be tearing down, causing awaited WASM FS calls to hang and
    // block the return of the encoded data. The VFS files are small and will
    // be overwritten or discarded on the next export.
    ff.deleteFile(inputName).catch(() => {})
    ff.deleteFile(outputName).catch(() => {})
  }
}

export async function exportVideo(opts: ExportOptions): Promise<Uint8Array> {
  const lockLease = acquireFfmpegLock()
  try {
    return await _exportVideoInner(opts)
  } finally {
    releaseFfmpegLock(lockLease)
  }
}

async function _exportVideoInner(opts: ExportOptions): Promise<Uint8Array> {
  const {
    file, trimStart, trimEnd, ratio, quality, cropMode,
    loudnessTarget, denoiseAudio, stripMetadata, silenceSegments,
    removeSilence, blurRegions, hasAudio, watermark,
    manualCuts, onProgress, onPhase,
    outputFormat = 'mp4',
  } = opts
  // Set to true when the source codec is confirmed non-decodable by WebCodecs
  // (e.g. HEVC). Used below to gate the HEVC-aware stream-copy fast path.
  let sourceNotDecodable = false

  // Tier 3: WebCodecs hardware path (hardware H.264, no WASM loading)
  if (!opts.skipWebCodecs && isWebCodecsViable(opts)) {
    const wcAvail = await checkWebCodecsAvailable()
    if (wcAvail) {
      const decodable = await checkFileDecodable(opts.file)
      if (!decodable) {
        sourceNotDecodable = true
        onPhase?.('Transcoding (compatibility mode)...')
      } else {
        try {
          return await exportVideoWebCodecs(opts)
        } catch (wcErr) {
          console.warn('[CalmClip] WebCodecs export failed, falling back to FFmpeg:', wcErr instanceof Error ? wcErr.message : String(wcErr))
          onPhase?.('Transcoding (compatibility mode)...')
        }
      }
    }
  }

  const ff = await loadFfmpeg()

  // Tier 2: Stream copy (instant for trim-only with matching output dimensions)
  const [streamCopyW, streamCopyH] = getRatioDims(ratio, quality)
  const streamCopySrcW = opts.sourceDims?.[0] ?? 0
  const streamCopySrcH = opts.sourceDims?.[1] ?? 0
  const streamCopyOk   =
    !(removeSilence && silenceSegments.length > 0) &&
    (manualCuts?.length ?? 0) === 0 &&
    blurRegions.length === 0 &&
    !watermark &&
    outputFormat !== 'webm'
  if (streamCopyOk && opts.sourceDims && streamCopySrcW === streamCopyW && streamCopySrcH === streamCopyH) {
    return exportVideoStreamCopy(ff, opts)
  }

  // HEVC / non-decodable source fast path: stream-copy the video track as-is.
  //
  // Decoding HEVC in single-threaded FFmpeg WASM takes ~15 min for a typical
  // iPhone video even at ultrafast. If the source codec is not decodable by
  // WebCodecs AND the export only needs trim + optional audio processing, skip
  // the decode-re-encode entirely: copy the video stream directly into the MP4
  // container. This turns a 15-min hang into a 3-5 s copy.
  //
  // Safety gate: only applies when the source aspect ratio matches the selected
  // output ratio (within 2 %). A mismatch means the user wants a crop/reframe,
  // which requires re-encoding; we fall through to the full transcode in that
  // case.
  if (sourceNotDecodable && streamCopyOk && opts.sourceDims) {
    const srcRatio = streamCopySrcW / streamCopySrcH
    const dstRatio = streamCopyW    / streamCopyH
    const ratioMatch = srcRatio > 0 && Math.abs(srcRatio - dstRatio) / dstRatio < 0.02
    if (ratioMatch) {
      return exportVideoStreamCopy(ff, opts)
    }
  }

  // phaseOffset and phaseScale let us remap 0-100% FFmpeg progress into
  // sub-ranges when running two-pass exports.
  let phaseOffset = 0
  let phaseScale  = 100
  const progressHandler = ({ progress }: { progress: number }) => {
    // FFmpeg emits NaN when output duration is unknown (e.g. concat-demuxer pass).
    // Negative values arise from PTS underflows. Both are discarded here; the
    // previous clamp-to-zero fix handles negative-but-finite values defensively,
    // but NaN must be rejected before the arithmetic to prevent NaN state.
    if (!isFinite(progress) || progress < 0) return
    const scaled = Math.round(phaseOffset + progress * phaseScale)
    onProgress(Math.min(scaled, 99))
  }
  ff.on('progress', progressHandler)

  const inputName  = 'input.mp4'
  const outputName = `output.${outputFormat}`
  const hasWm      = !!watermark

  // Signal the UI before the first slow awaits so the user sees "Preparing…"
  // instead of "Loading engine" during the file-copy-into-WASM step (which can
  // take 5-30s for large files even when the WASM module is already cached).
  onPhase?.('Preparing...')

  try {
    await ff.writeFile(inputName, await fetchFile(file))
    if (hasWm) await ff.writeFile(WM_FILE, await fetchFile(watermark!.file))

    const [outW, outH] = getRatioDims(ratio, quality)

    const duration    = trimEnd - trimStart
    const scaleFilter = buildScaleFilter(outW, outH, cropMode)

    const allCuts: SilenceSegment[] = [
      ...(removeSilence ? silenceSegments : []),
      ...(manualCuts ?? []),
    ].sort((a, b) => a.start - b.start)

    const keepSegments = allCuts.length > 0
      ? computeKeepSegments(allCuts, trimStart, trimEnd)
      : []

    if (allCuts.length > 0 && keepSegments.length === 0) {
      throw new Error('All content has been marked for removal. Nothing is left to export. Reduce the silence threshold or remove some manual cuts.')
    }

    if (keepSegments.length > 0) {
      return await exportWithCuts({
        ff, inputName, outputName, keepSegments, scaleFilter,
        outW, outH, loudnessTarget, denoiseAudio: denoiseAudio ?? false,
        stripMetadata, blurRegions, hasAudio, watermark,
        trimStart, outputFormat,
        onProgress,
        onPhaseChange: (label, offset, scale) => {
          phaseOffset = offset
          phaseScale  = scale
          onPhase?.(label)
        },
      })
    }

    onPhase?.('Exporting video...')

    const audioFilter = buildAudioFilter(loudnessTarget, denoiseAudio ?? false)

    // Signal the progress callback the moment FFmpeg first logs a line.
    // This moves the UI out of "Preparing..." even when progress events return
    // NaN (e.g. loudnorm with unknown output duration), so users see "Exporting
    // video..." with an indeterminate bar instead of being stuck forever.
    let _startedSignalled = false
    const signalStarted = () => {
      if (_startedSignalled) return
      _startedSignalled = true
      onProgress(0)
    }

    if (blurRegions.length === 0 && !hasWm) {
      const args: string[] = [
        '-ss', String(trimStart),
        '-t',  String(duration),
        '-i',  inputName,
        '-vf', scaleFilter,
        ...codecArgs(outputFormat, hasAudio, audioFilter, true),
      ]
      if (stripMetadata) args.push('-map_metadata', '-1')
      args.push('-y', outputName)
      validateFilterExpr(scaleFilter, '-vf')
      await runFfmpegWithWatchdog(ff, args, calcStaleMs(duration), signalStarted, true)
    } else {
      const parts: string[] = []
      parts.push(`[0:v]${scaleFilter}[vsc]`)
      let vLabel = 'vsc'

      if (blurRegions.length > 0) {
        const { parts: blurParts, outputLabel } = buildBlurChain(vLabel, blurRegions, outW, outH)
        parts.push(...blurParts)
        vLabel = outputLabel
      }

      const inputArgs: string[] = [
        '-ss', String(trimStart), '-t', String(duration), '-i', inputName,
      ]
      if (hasWm) inputArgs.push('-i', WM_FILE)

      if (hasWm) {
        const wmIdx = 1
        const { parts: wmParts, outputLabel } = buildWmChain(vLabel, wmIdx, outW, outH, watermark!)
        parts.push(...wmParts)
        vLabel = outputLabel
      }

      // Pull the audio filter chain into the filter_complex graph.
      // Using a separate -af alongside -filter_complex causes loudnorm (linear
      // mode) to buffer the entire audio stream before outputting, which stalls
      // the muxer while video frames are ready, leaving the export at 0%.
      // Keeping everything in one graph lets FFmpeg schedule audio/video together.
      // When an audio filter is present, route [0:a] through the filter_complex
      // graph and map the named output pad. When no filter is needed, map the
      // raw stream directly (no brackets around a stream specifier).
      const audioInGraph = hasAudio && !!audioFilter
      if (audioInGraph) {
        parts.push(`[0:a]${audioFilter}[aout]`)
      }

      const filterComplex = parts.join('; ')
      validateFilterExpr(filterComplex, 'filter_complex')
      const audioMapArg = audioInGraph ? '[aout]' : '0:a'
      const args: string[] = [
        ...inputArgs,
        '-filter_complex', filterComplex,
        '-map',            `[${vLabel}]`,
        ...(hasAudio && outputFormat !== 'webm' ? ['-map', audioMapArg] : []),
        ...codecArgs(outputFormat, hasAudio, null, true),
        ...(hasAudio && outputFormat === 'webm' ? ['-map', audioMapArg] : []),
      ]
      if (stripMetadata) args.push('-map_metadata', '-1')
      args.push('-y', outputName)
      await runFfmpegWithWatchdog(ff, args, calcStaleMs(duration), signalStarted, true)
    }
    onProgress(99)

    const result = (await ff.readFile(outputName)) as Uint8Array
    if (!result || result.byteLength === 0) {
      throw new Error('FFmpeg produced an empty output file. The export may have failed silently. Try reducing quality or simplifying the edits.')
    }
    return result
  } finally {
    ff.off('progress', progressHandler)
    ff.deleteFile(inputName).catch(() => {})
    ff.deleteFile(outputName).catch(() => {})
    if (hasWm) { ff.deleteFile(WM_FILE).catch(() => {}) }
  }
}

interface CutsExportParams {
  ff:                FFmpeg
  inputName:         string
  outputName:        string
  keepSegments:      [number, number][]
  scaleFilter:       string
  outW:              number
  outH:              number
  loudnessTarget:    LoudnessTarget
  denoiseAudio:      boolean
  stripMetadata:     boolean
  blurRegions:       BlurRegion[]
  hasAudio:          boolean
  watermark?:        WatermarkOpts
  trimStart:         number
  outputFormat:      OutputFormat
  onPhaseChange?:    (label: string, offset: number, scale: number) => void
  // Called with 99 just before ff.readFile so the progress bar advances to
  // the same near-complete state as the non-cuts path. Without this, the bar
  // stops at whatever FFmpeg's last progress event reported and jumps to "done".
  onProgress?:       (pct: number) => void
}

async function exportWithCuts(p: CutsExportParams): Promise<Uint8Array> {
  const {
    ff, inputName, outputName, keepSegments, scaleFilter,
    outW, outH, loudnessTarget, denoiseAudio,
    stripMetadata, blurRegions, hasAudio, watermark,
    outputFormat, onPhaseChange,
  } = p

  const hasWm       = !!watermark
  const audioFilter = buildAudioFilter(loudnessTarget, denoiseAudio)
  const hasLoud     = hasAudio && !!audioFilter

  try {
    const allParts: string[] = []
    // segLabels interleaves video and audio per segment: [v0][a0][v1][a1]...
    // FFmpeg concat requires this order (v+a inputs per segment, not all-v then all-a).
    const segLabels: string[] = []

    keepSegments.forEach(([s, e], i) => {
      const scaledLabel = `sv${i}`
      allParts.push(
        `[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS,${scaleFilter}[${scaledLabel}]`
      )
      const { parts: blurParts, outputLabel } = buildBlurChain(scaledLabel, blurRegions, outW, outH, i)
      allParts.push(...blurParts)
      segLabels.push(`[${outputLabel}]`)

      if (hasAudio) {
        const aLabel = `sa${i}`
        allParts.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[${aLabel}]`)
        segLabels.push(`[${aLabel}]`)
      }
    })

    const n = keepSegments.length

    let nextVLabel = 'vconcatraw'
    const aConcatOut = hasAudio ? (hasLoud ? '[aconcat]' : '[aout]') : ''

    allParts.push(
      `${segLabels.join('')}concat=n=${n}:v=1:a=${hasAudio ? 1 : 0}[${nextVLabel}]${aConcatOut}`
    )

    let curV = nextVLabel

    if (hasWm) {
      const { parts: wmParts, outputLabel: wmOut } = buildWmChain(curV, 1, outW, outH, watermark!)
      allParts.push(...wmParts)
      curV = wmOut
    }

    const inputArgs: string[] = ['-i', inputName]
    if (hasWm) inputArgs.push('-i', WM_FILE)

    const outDuration = keepSegments.reduce((acc, [s, e]) => acc + (e - s), 0)
    onPhaseChange?.('Exporting video...', 0, 100)

    const finalVLabel = curV

    if (hasLoud) {
      allParts.push(`[aconcat]${audioFilter}[aout]`)
    }

    const filterComplex = allParts.join('; ')
    validateFilterExpr(filterComplex, 'filter_complex (cuts)')
    const args: string[] = [
      ...inputArgs,
      '-filter_complex', filterComplex,
      '-map',            `[${finalVLabel}]`,
    ]
    if (hasAudio) args.push('-map', '[aout]')
    // omitFastStart=true: the +faststart moov-relocation second pass triggers
    // MT pthread teardown in the WASM core and kills the worker before
    // readFile() can complete. All other export paths already omit faststart
    // for the same reason. Moov-at-tail is valid for direct download and
    // upload platforms re-process the container on ingest.
    args.push(...codecArgs(outputFormat, hasAudio, null, true))
    if (stripMetadata) args.push('-map_metadata', '-1')
    args.push('-y', outputName)

    await runFfmpegWithWatchdog(ff, args, calcStaleMs(outDuration), undefined, true)
    // Signal 99 % before readFile so the bar advances past whatever FFmpeg's
    // last progress event reported. readFile produces no progress events, so
    // without this the bar stays at an intermediate value until "done" appears.
    p.onProgress?.(99)
    const result = (await ff.readFile(outputName)) as Uint8Array
    if (!result || result.byteLength === 0) {
      throw new Error('FFmpeg produced an empty output file. The export may have failed silently. Try reducing quality or simplifying the edits.')
    }
    return result
  } finally {
    // Fire-and-forget: do NOT await deleteFile (see exportVideo finally block comment).
  }
}
