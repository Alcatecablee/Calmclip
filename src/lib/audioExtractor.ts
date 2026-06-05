import { loadFfmpeg, isFFmpegBusy } from './ffmpeg'
import { fetchFile } from '@ffmpeg/util'

const INPUT_NAME  = 'whisper-in'
const OUTPUT_NAME = 'whisper-out.wav'

// Extracts audio from a video file as a 16 kHz mono WAV blob, which is the
// exact format Whisper requires. Uses FFmpeg WASM so extraction takes a few
// seconds regardless of video duration (unlike the real-time MediaRecorder
// approach, which takes as long as the video itself).
//
// Throws if FFmpeg is currently running an export, if the video has no audio
// track, or if the extraction times out.
export async function extractAudioFromVideo(videoFile: File): Promise<Blob> {
  if (isFFmpegBusy()) {
    throw new Error(
      'A video export is in progress. Please wait for it to finish before transcribing.',
    )
  }

  const ff = await loadFfmpeg()

  try {
    await ff.writeFile(INPUT_NAME, await fetchFile(videoFile))

    const code = await Promise.race([
      ff.exec([
        '-i',   INPUT_NAME,
        '-vn',             // drop video stream
        '-ar',  '16000',   // 16 kHz: Whisper required sample rate
        '-ac',  '1',       // mono
        '-f',   'wav',
        OUTPUT_NAME,
        '-y',
      ]) as Promise<number>,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(
            'Audio extraction timed out after 2 minutes. ' +
            'The file may be in an unsupported format or too large to process.',
          )),
          120_000,
        )
      ),
    ])

    if (code !== 0) {
      throw new Error(
        'Could not extract audio from this video. ' +
        'The file may have no audio track or use an unsupported codec.',
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
}
