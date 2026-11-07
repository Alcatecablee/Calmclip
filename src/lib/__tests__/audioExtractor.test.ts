import { describe, it, expect, beforeEach, vi } from 'vitest'
import { extractAudioFromVideo, MEMFS_FALLBACK_MAX_BYTES } from '../audioExtractor'

const mockFf = {
  createDir: vi.fn(),
  deleteDir: vi.fn(),
  mount: vi.fn(),
  unmount: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  deleteFile: vi.fn(),
}

const mockAcquireLock = vi.fn()
const mockReleaseLock = vi.fn()
const mockRunWatchdog = vi.fn()
const mockFetchFile = vi.fn()

vi.mock('../ffmpeg', () => ({
  loadFfmpeg: vi.fn(() => Promise.resolve(mockFf)),
  acquireFfmpegLock: (...args: unknown[]) => mockAcquireLock(...args),
  releaseFfmpegLock: (...args: unknown[]) => mockReleaseLock(...args),
  runFfmpegWithWatchdog: (...args: unknown[]) => mockRunWatchdog(...args),
}))

vi.mock('@ffmpeg/util', () => ({
  fetchFile: (...args: unknown[]) => mockFetchFile(...args),
}))

describe('audioExtractor with WORKERFS mounting', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockFf.createDir.mockResolvedValue(true)
    mockFf.deleteDir.mockResolvedValue(true)
    mockFf.mount.mockResolvedValue(true)
    mockFf.unmount.mockResolvedValue(true)
    mockFf.writeFile.mockResolvedValue(true)
    mockFf.readFile.mockResolvedValue(new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69]))
    mockFf.deleteFile.mockResolvedValue(true)

    mockRunWatchdog.mockResolvedValue(undefined)
    mockFetchFile.mockResolvedValue(new Uint8Array(100))
  })

  it('1. mounts WORKERFS with the original File object without calling fetchFile', async () => {
    const file = new File(['dummy-video-content'], 'interview.mp4', { type: 'video/mp4' })

    const result = await extractAudioFromVideo(file)

    expect(result).toBeInstanceOf(Blob)
    expect(result.type).toBe('audio/wav')

    // Verified: lock was acquired and released
    expect(mockAcquireLock).toHaveBeenCalledTimes(1)
    expect(mockReleaseLock).toHaveBeenCalledTimes(1)

    // Verified: createDir and mount called with WORKERFS and single blobs entry
    expect(mockFf.createDir).toHaveBeenCalledWith(expect.stringMatching(/^\/workerfs_\d+_\d+$/))
    expect(mockFf.mount).toHaveBeenCalledWith(
      'WORKERFS',
      {
        blobs: [{ name: 'input.mp4', data: file }],
      },
      expect.stringMatching(/^\/workerfs_\d+_\d+$/),
    )

    // Verified: fetchFile was NOT called on the WORKERFS path
    expect(mockFetchFile).not.toHaveBeenCalled()
    expect(mockFf.writeFile).not.toHaveBeenCalled()
  })

  it('2. passes the mounted input path to FFmpeg exec args', async () => {
    const file = new File(['data'], 'presentation.mov', { type: 'video/quicktime' })

    await extractAudioFromVideo(file, 5, 25)

    expect(mockRunWatchdog).toHaveBeenCalledTimes(1)
    const passedArgs = mockRunWatchdog.mock.calls[0][1] as string[]

    // Verified trimming args: -ss 5 -t 20
    expect(passedArgs).toContain('-ss')
    expect(passedArgs).toContain('5')
    expect(passedArgs).toContain('-t')
    expect(passedArgs).toContain('20')

    // Verified audio format: 16kHz mono WAV without video
    expect(passedArgs).toContain('-vn')
    expect(passedArgs).toContain('-ar')
    expect(passedArgs).toContain('16000')
    expect(passedArgs).toContain('-ac')
    expect(passedArgs).toContain('1')
    expect(passedArgs).toContain('-f')
    expect(passedArgs).toContain('wav')

    // Verified input is the mounted file path
    const inputFlagIdx = passedArgs.indexOf('-i')
    expect(inputFlagIdx).toBeGreaterThanOrEqual(0)
    expect(passedArgs[inputFlagIdx + 1]).toMatch(/^\/workerfs_\d+_\d+\/input\.mov$/)
  })

  it('3. unmounts WORKERFS, removes directory, and cleans output file upon success', async () => {
    const file = new File(['data'], 'clip.mp4', { type: 'video/mp4' })

    await extractAudioFromVideo(file)

    expect(mockFf.unmount).toHaveBeenCalledWith(expect.stringMatching(/^\/workerfs_\d+_\d+$/))
    expect(mockFf.deleteDir).toHaveBeenCalledWith(expect.stringMatching(/^\/workerfs_\d+_\d+$/))
    expect(mockFf.deleteFile).toHaveBeenCalledWith(expect.stringMatching(/^whisper_out_\d+_\d+\.wav$/))
  })

  it('4. unmounts WORKERFS and releases lock even when FFmpeg execution fails', async () => {
    const file = new File(['data'], 'corrupted.mp4', { type: 'video/mp4' })
    mockRunWatchdog.mockRejectedValueOnce(new Error('WASM internal decode error'))

    await expect(extractAudioFromVideo(file)).rejects.toThrow('Could not extract audio from this video')

    // Unmount and deleteDir must still execute
    expect(mockFf.unmount).toHaveBeenCalledTimes(1)
    expect(mockFf.deleteDir).toHaveBeenCalledTimes(1)
    expect(mockFf.deleteFile).toHaveBeenCalledTimes(1)
    expect(mockReleaseLock).toHaveBeenCalledTimes(1)
  })

  it('5. falls back to MEMFS when WORKERFS mounting fails for small files', async () => {
    mockFf.mount.mockRejectedValueOnce(new Error('WORKERFS not supported in worker environment'))

    // 5 MB file: well below MEMFS_FALLBACK_MAX_BYTES (100 MB)
    const smallFile = {
      name: 'small.mp4',
      size: 5 * 1024 * 1024,
      type: 'video/mp4',
    } as unknown as File

    const result = await extractAudioFromVideo(smallFile)

    expect(result).toBeInstanceOf(Blob)
    expect(mockFetchFile).toHaveBeenCalledWith(smallFile)
    expect(mockFf.writeFile).toHaveBeenCalledTimes(1)

    // Mount directory was cleaned up after mount failure
    expect(mockFf.deleteDir).toHaveBeenCalled()
    // Input file in MEMFS was cleaned up
    expect(mockFf.deleteFile).toHaveBeenCalledWith(expect.stringMatching(/^memfs_input_\d+_\d+\.mp4$/))
    expect(mockReleaseLock).toHaveBeenCalled()
  })

  it('6. throws actionable error without calling fetchFile when WORKERFS fails for large files', async () => {
    mockFf.mount.mockRejectedValueOnce(new Error('FileReaderSync denied'))

    // 50 MB file: exceeds MEMFS_FALLBACK_MAX_BYTES (25 MB)
    const largeFile = {
      name: 'huge_4k_recording.mp4',
      size: 50 * 1024 * 1024,
      type: 'video/mp4',
    } as unknown as File

    await expect(extractAudioFromVideo(largeFile)).rejects.toThrow(
      /Direct file mounting \(WORKERFS\) failed.*50 MB.*Files larger than 25 MB cannot be safely copied into memory/
    )

    // fetchFile must NEVER be called for large files on fallback
    expect(mockFetchFile).not.toHaveBeenCalled()
    expect(mockFf.writeFile).not.toHaveBeenCalled()
    expect(mockReleaseLock).toHaveBeenCalledTimes(1)
  })

  it('7. handles special filenames and missing extensions safely', async () => {
    const file = new File(['data'], 'My Raw [Video] (Final) #1!', { type: 'video/mp4' })

    await extractAudioFromVideo(file)

    const passedArgs = mockRunWatchdog.mock.calls[0][1] as string[]
    const inputFlagIdx = passedArgs.indexOf('-i')
    // Sanitized extension defaults to .mp4
    expect(passedArgs[inputFlagIdx + 1]).toMatch(/^\/workerfs_\d+_\d+\/input\.mp4$/)
  })

  it('8. releases lock and cleans up when output reading fails or produces empty output', async () => {
    const file = new File(['data'], 'empty_audio.mp4', { type: 'video/mp4' })
    mockFf.readFile.mockResolvedValueOnce(new Uint8Array(0))

    await expect(extractAudioFromVideo(file)).rejects.toThrow('Audio extraction produced empty output')

    expect(mockFf.unmount).toHaveBeenCalledTimes(1)
    expect(mockFf.deleteDir).toHaveBeenCalledTimes(1)
    expect(mockFf.deleteFile).toHaveBeenCalledWith(expect.stringMatching(/^whisper_out_\d+_\d+\.wav$/))
    expect(mockReleaseLock).toHaveBeenCalledTimes(1)
  })

  it('9. releases lock and continues cleanup when unmount throws an error', async () => {
    const file = new File(['data'], 'unmount_fail.mp4', { type: 'video/mp4' })
    mockFf.unmount.mockRejectedValueOnce(new Error('FS unmount internal error'))

    // Should successfully return the Blob without letting unmount error crash the call
    const result = await extractAudioFromVideo(file)
    expect(result).toBeInstanceOf(Blob)

    // deleteDir is still attempted even if unmount threw
    expect(mockFf.deleteDir).toHaveBeenCalledTimes(1)
    expect(mockReleaseLock).toHaveBeenCalledTimes(1)
  })

  it('10. releases lock when directory deletion throws an error', async () => {
    const file = new File(['data'], 'deletedir_fail.mp4', { type: 'video/mp4' })
    mockFf.deleteDir.mockRejectedValueOnce(new Error('Directory not empty or locked'))

    const result = await extractAudioFromVideo(file)
    expect(result).toBeInstanceOf(Blob)

    // Lock must still be released
    expect(mockReleaseLock).toHaveBeenCalledTimes(1)
  })

  it('11. does not conceal original FFmpeg execution error when cleanup also fails', async () => {
    const file = new File(['data'], 'cascade_fail.mp4', { type: 'video/mp4' })
    mockRunWatchdog.mockRejectedValueOnce(new Error('Transcode decoding failed'))
    mockFf.unmount.mockRejectedValueOnce(new Error('Unmount failed during cascade'))
    mockFf.deleteDir.mockRejectedValueOnce(new Error('DeleteDir failed during cascade'))

    await expect(extractAudioFromVideo(file)).rejects.toThrow('Could not extract audio from this video')

    // Lock must STILL be released
    expect(mockReleaseLock).toHaveBeenCalledTimes(1)
  })

  it('12. falls back to MEMFS when ff.mount() returns false for small files', async () => {
    mockFf.mount.mockResolvedValueOnce(false)

    const smallFile = {
      name: 'clip.mp4',
      size: 10 * 1024 * 1024, // 10 MB <= 25 MB
      type: 'video/mp4',
    } as unknown as File

    const result = await extractAudioFromVideo(smallFile)
    expect(result).toBeInstanceOf(Blob)

    expect(mockFetchFile).toHaveBeenCalledWith(smallFile)
    expect(mockFf.writeFile).toHaveBeenCalledTimes(1)
    expect(mockFf.deleteDir).toHaveBeenCalledTimes(1)
    expect(mockReleaseLock).toHaveBeenCalledTimes(1)
  })

  it('13. refuses MEMFS copy and throws when ff.mount() returns false for large files', async () => {
    mockFf.mount.mockResolvedValueOnce(false)

    const largeFile = {
      name: 'massive.mp4',
      size: 150 * 1024 * 1024, // 150 MB > 25 MB
      type: 'video/mp4',
    } as unknown as File

    await expect(extractAudioFromVideo(largeFile)).rejects.toThrow(
      /Direct file mounting \(WORKERFS\) failed: WORKERFS filesystem driver is not available.*150 MB.*Files larger than 25 MB cannot be safely copied into memory/
    )

    expect(mockFetchFile).not.toHaveBeenCalled()
    expect(mockFf.writeFile).not.toHaveBeenCalled()
    expect(mockFf.deleteDir).toHaveBeenCalledTimes(1)
    expect(mockReleaseLock).toHaveBeenCalledTimes(1)
  })
})
