import { loadFfmpeg, acquireFfmpegLock, releaseFfmpegLock, runFfmpegWithWatchdog } from './ffmpeg'
import { fetchFile } from '@ffmpeg/util'

const INPUT_NAME  = 'whisper-in'
const OUTPUT_NAME = 'whisper-out.wav'

// Extracts audio from a video file as a 16 kHz mono WAV blob, which is the
// exact format Whisper requires. Uses FFmpeg WASM so extraction takes a few
// seconds regardless of video duration (unlike the real-time MediaRecorder
// approach, which takes as long as the video itself).
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
  acquireFfmpegLock()

  try {
    const ff = await loadFfmpeg()

    try {
      await ff.writeFile(INPUT_NAME, await fetchFile(videoFile))

      // Build FFmpeg args. When trim is active, seek before the input for fast
      // keyframe-based seek, then cap with -t. This matches the pattern used in
      // whisper.ts:extractAudioForWhisper and keeps the audio duration bounded
      // to the user's trim range so Whisper only sees the relevant segment.
      const args: string[] = []
      const hasTrimStart = trimStart > 0
      const hasTrimEnd   = trimEnd !== null && trimEnd > trimStart
      if (hasTrimStart) {
        args.push('-ss', String(trimStart))
      }
      if (hasTrimEnd) {
        args.push('-t', String(trimEnd! - trimStart))
      }
      args.push(
        '-i',   INPUT_NAME,
        '-vn',
        '-ar',  '16000',
        '-ac',  '1',
        '-f',   'wav',
        OUTPUT_NAME,
        '-y',
      )

      try {
        await runFfmpegWithWatchdog(ff, args, 120_000)
      } catch (err) {
        throw new Error(
          `Could not extract audio from this video. The file may have no audio track or use an unsupported codec. (${err instanceof Error ? err.message : String(err)})`
        )
      }

      const data = await ff.readFile(OUTPUT_NAME) as Uint8Array
      if (!data?.byteLength) {
        throw new Error(
          'Audio extraction produced empty output. The video may have no audio track.',
        )
      }

      return new Blob([data as Uint8Array<ArrayBuffer>], { type: 'audio/wav' })
    } finally {
      // Fire-and-forget cleanup: do not await, mirroring the pattern in ffmpeg.ts.
      // Awaiting deleteFile after exec can hang when the MT pthreads runtime is
      // tearing down.
      ff.deleteFile(INPUT_NAME).catch(() => {})
      ff.deleteFile(OUTPUT_NAME).catch(() => {})
    }
  } finally {
    releaseFfmpegLock()
  }
}
