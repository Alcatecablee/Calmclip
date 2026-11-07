import { loadFfmpeg, acquireFfmpegLock, releaseFfmpegLock, runFfmpegWithWatchdog } from './ffmpeg'
import type { FFmpeg, FFFSType } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

// Threshold for copying a video into MEMFS if direct WORKERFS mounting is unavailable.
// Memory lifecycle during MEMFS fallback:
// 1. fetchFile() reads File into an ArrayBuffer via FileReader (1x file size in JS heap).
// 2. fetchFile() then invokes new Uint8Array(data); because data is already a TypedArray,
//    this allocates a second ArrayBuffer and copies the bytes (another 1x file size in JS heap).
// 3. ff.writeFile() transfers this second buffer to the Web Worker via postMessage transfer list,
//    while the initial ArrayBuffer remains in main-thread JS heap until garbage collection.
// 4. In the worker, Emscripten FS.writeFile stores the file in MEMFS (an additional in-memory
//    filesystem representation).
// The combined transient peak across JavaScript heap and worker memory is provisionally
// estimated at ~2.5x to 3x input file size before garbage collection. For large files,
// this transient surge creates severe memory pressure and risks browser tab crashes.
// Files exceeding 25 MB are therefore not copied into memory on fallback.
export const MEMFS_FALLBACK_MAX_BYTES = 25 * 1024 * 1024 // 25 MB

function getCleanExtension(fileName: string): string {
  const parts = fileName.split('.')
  if (parts.length <= 1) return 'mp4'
  const ext = parts.pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  return ext || 'mp4'
}

let sessionCounter = 0

// Extracts audio from a video file as a 16 kHz mono WAV blob, which is the
// exact format Whisper requires. Uses FFmpeg WASM so extraction takes a few
// seconds regardless of video duration (unlike the real-time MediaRecorder
// approach, which takes as long as the video itself).
//
// Primary mechanism:
// Mounts the original browser File directly into FFmpeg's virtual filesystem
// using WORKERFS. This allows FFmpeg to stream read-only bytes on demand via
// FileReaderSync without duplicating the file in JavaScript memory or MEMFS.
//
// Fallback mechanism:
// If WORKERFS mounting is unavailable or fails, small files (up to 25 MB)
// may fall back to copying into MEMFS. Larger files fail explicitly with an
// actionable message rather than risking an unrecoverable browser OOM crash.
//
// When trimStart > 0 or trimEnd is provided, only the specified segment is
// extracted. This keeps Whisper working on the same clip the user sees and
// keeps timestamps relative to 0 so the caller can offset by trimStart.
//
// Throws if FFmpeg is currently running an export, if the video has no audio
// track, or if the extraction times out.
export async function extractAudioFromVideo(
  videoFile: File,
  trimStart = 0,
  trimEnd: number | null = null,
): Promise<Blob> {
  const lockLease = acquireFfmpegLock()

  const id = `${Date.now()}_${++sessionCounter}`
  const mountDir = `/workerfs_${id}`
  const ext = getCleanExtension(videoFile.name)
  const mountedFileName = `input.${ext}`
  const mountedFilePath = `${mountDir}/${mountedFileName}`
  const memfsInputName = `memfs_input_${id}.${ext}`
  const outputName = `whisper_out_${id}.wav`

  let ffInstance: FFmpeg | null = null
  let isMounted = false
  let isMemfsFallback = false

  try {
    const ff = await loadFfmpeg()
    ffInstance = ff

    let inputPath = mountedFilePath

    try {
      await ff.createDir(mountDir)
      const mounted = await ff.mount(
        'WORKERFS' as FFFSType,
        {
          blobs: [{ name: mountedFileName, data: videoFile }],
        },
        mountDir,
      )
      if (!mounted) {
        throw new Error('WORKERFS filesystem driver is not available in this FFmpeg core')
      }
      isMounted = true
      inputPath = mountedFilePath
    } catch (mountErr) {
      try {
        await ff.deleteDir(mountDir)
      } catch {
        // Ignore directory deletion error on mount failure
      }

      if (videoFile.size > MEMFS_FALLBACK_MAX_BYTES) {
        const sizeMb = Math.round(videoFile.size / (1024 * 1024))
        const limitMb = Math.round(MEMFS_FALLBACK_MAX_BYTES / (1024 * 1024))
        throw new Error(
          `Direct file mounting (WORKERFS) failed: ${mountErr instanceof Error ? mountErr.message : String(mountErr)}. ` +
          `This file is ${sizeMb} MB. Files larger than ${limitMb} MB cannot be safely copied into memory without risking a browser crash.`
        )
      }

      console.warn(
        `[CalmClip] WORKERFS mount failed (${mountErr instanceof Error ? mountErr.message : String(mountErr)}). ` +
        `Falling back to MEMFS for small file (${Math.round(videoFile.size / (1024 * 1024))} MB).`
      )
      await ff.writeFile(memfsInputName, await fetchFile(videoFile))
      isMemfsFallback = true
      inputPath = memfsInputName
    }

    try {
      // Build FFmpeg args. When trim is active, seek before the input for fast
      // keyframe-based seek, then cap with -t. This matches the pattern used in
      // whisper.ts:extractAudioForWhisper and keeps the audio duration bounded
      // to the user's trim range so Whisper only sees the relevant segment.
      const args: string[] = []
      const hasTrimStart = trimStart > 0
      const hasTrimEnd = trimEnd !== null && trimEnd > trimStart
      if (hasTrimStart) {
        args.push('-ss', String(trimStart))
      }
      if (hasTrimEnd) {
        args.push('-t', String(trimEnd! - trimStart))
      }
      args.push(
        '-i',   inputPath,
        '-vn',
        '-ar',  '16000',
        '-ac',  '1',
        '-f',   'wav',
        outputName,
        '-y',
      )

      try {
        await runFfmpegWithWatchdog(ff, args, 120_000)
      } catch (err) {
        throw new Error(
          `Could not extract audio from this video. The file may have no audio track or use an unsupported codec. (${err instanceof Error ? err.message : String(err)})`
        )
      }

      const data = await ff.readFile(outputName) as Uint8Array
      if (!data?.byteLength) {
        throw new Error(
          'Audio extraction produced empty output. The video may have no audio track.',
        )
      }

      return new Blob([data as Uint8Array<ArrayBuffer>], { type: 'audio/wav' })
    } finally {
      // Fire-and-forget cleanup of temporary output and MEMFS files
      ff.deleteFile(outputName).catch(() => {})
      if (isMemfsFallback) {
        ff.deleteFile(memfsInputName).catch(() => {})
      }
    }
  } finally {
    if (isMounted && ffInstance) {
      try {
        await ffInstance.unmount(mountDir)
      } catch (unmountErr) {
        console.warn('[CalmClip] WORKERFS unmount failed:', unmountErr)
      }
      try {
        await ffInstance.deleteDir(mountDir)
      } catch (deleteDirErr) {
        console.warn('[CalmClip] WORKERFS deleteDir failed:', deleteDirErr)
      }
    }
    releaseFfmpegLock(lockLease)
  }
}
