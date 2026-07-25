import { loadFfmpeg, fetchFile, acquireFfmpegLock, releaseFfmpegLock, runFfmpegWithWatchdog } from './ffmpeg'

export interface SilenceSegment {
  start: number
  end:   number
}

export async function detectSilence(
  file:      File,
  trimStart: number,
  trimEnd:   number,
  noiseDb:   number = -50,
  minDur:    number = 1.0,
): Promise<SilenceSegment[]> {
  acquireFfmpegLock()
  try {
    const ff = await loadFfmpeg()

    const segments: SilenceSegment[] = []
    let currentStart: number | null  = null

    const logHandler = ({ message }: { message: string }) => {
      const startMatch = /silence_start: ([\d.]+)/.exec(message)
      const endMatch   = /silence_end: ([\d.]+)/.exec(message)
      if (startMatch) currentStart = parseFloat(startMatch[1])
      if (endMatch && currentStart !== null) {
        segments.push({ start: currentStart, end: parseFloat(endMatch[1]) })
        currentStart = null
      }
    }

    ff.on('log', logHandler)

    try {
      await ff.writeFile('sil_input.mp4', await fetchFile(file))

      // Build FFmpeg args. Only add seek/duration flags when the trim range is
      // meaningfully set. trimEnd uses 0 as its uninitialized sentinel in
      // App.tsx state; passing -t 0 to FFmpeg produces unreliable results.
      const hasTrimStart = trimStart > 0
      const hasTrimEnd   = trimEnd > trimStart
      const silArgs: string[] = []
      if (hasTrimStart) silArgs.push('-ss', String(trimStart))
      if (hasTrimEnd)   silArgs.push('-t',  String(trimEnd - trimStart))
      silArgs.push(
        '-i',  'sil_input.mp4',
        '-vn',
        '-af', `silencedetect=noise=${noiseDb}dB:d=${minDur}`,
        '-f',  'null',
        '-',
      )

      try {
        await runFfmpegWithWatchdog(ff, silArgs)
      } catch (err) {
        throw new Error(`Silence detection failed. The file may have no audio track or an unsupported codec. (${err instanceof Error ? err.message : String(err)})`)
      }
    } finally {
      ff.off('log', logHandler)
      // Fire-and-forget cleanup: do not await, to avoid MT teardown hangs
      ff.deleteFile('sil_input.mp4').catch(() => {})
    }

    return segments
  } finally {
    releaseFfmpegLock()
  }
}
