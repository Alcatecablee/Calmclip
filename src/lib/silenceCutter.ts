import { loadFfmpeg, fetchFile } from './ffmpeg'

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
  const ff = await loadFfmpeg()

  const segments: SilenceSegment[] = []
  let currentStart: number | null  = null

  const logLines: string[] = []
  const logHandler = ({ message }: { message: string }) => {
    logLines.push(message)
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

    const code = await ff.exec([
      '-ss',  String(trimStart),
      '-t',   String(trimEnd - trimStart),
      '-i',   'sil_input.mp4',
      '-vn',
      '-af',  `silencedetect=noise=${noiseDb}dB:d=${minDur}`,
      '-f',   'null',
      '-',
    ])

    if (code !== 0) {
      const tail = logLines.slice(-10).join('\n').trim()
      throw new Error(
        `Silence detection failed (exit code ${code}). The file may have no audio track, an unsupported codec, or be corrupted.` +
        (tail ? `\n\n${tail}` : '')
      )
    }
  } finally {
    ff.off('log', logHandler)
    try { await ff.deleteFile('sil_input.mp4') } catch { /* ignore */ }
  }

  return segments
}
