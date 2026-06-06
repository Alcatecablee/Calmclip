import type { TranscriptResult, TranscriptChunk } from './whisper'

interface SubtitleCue {
  index:  number
  start:  number
  end:    number
  text:   string
}

function formatSrtTime(sec: number): string {
  const h   = Math.floor(sec / 3600)
  const m   = Math.floor((sec % 3600) / 60)
  const s   = Math.floor(sec % 60)
  const ms  = Math.round((sec % 1) * 1000)
  return (
    String(h).padStart(2, '0') + ':' +
    String(m).padStart(2, '0') + ':' +
    String(s).padStart(2, '0') + ',' +
    String(ms).padStart(3, '0')
  )
}

function formatVttTime(sec: number): string {
  const h   = Math.floor(sec / 3600)
  const m   = Math.floor((sec % 3600) / 60)
  const s   = Math.floor(sec % 60)
  const ms  = Math.round((sec % 1) * 1000)
  return (
    String(h).padStart(2, '0') + ':' +
    String(m).padStart(2, '0') + ':' +
    String(s).padStart(2, '0') + '.' +
    String(ms).padStart(3, '0')
  )
}

const SENTENCE_END = /[.!?,]$/

function buildCues(chunks: TranscriptChunk[]): SubtitleCue[] {
  const valid = chunks.filter(c => c.timestamp[0] != null)
  if (valid.length === 0) return []

  const cues: SubtitleCue[] = []
  let group: TranscriptChunk[] = []

  function flush() {
    if (group.length === 0) return
    const first = group[0]
    const last  = group[group.length - 1]
    const start = first.timestamp[0]!
    const end   = last.timestamp[1] ?? last.timestamp[0]! + 1.5
    const text  = group.map(c => c.text ?? '').join(' ').replace(/\s+/g, ' ').trim()
    if (text) {
      cues.push({ index: cues.length + 1, start, end, text })
    }
    group = []
  }

  for (const chunk of valid) {
    group.push(chunk)
    const groupStart = group[0].timestamp[0]!
    const chunkEnd   = chunk.timestamp[1] ?? chunk.timestamp[0]! + 1.5
    const duration   = chunkEnd - groupStart
    const endsLine   = SENTENCE_END.test((chunk.text ?? '').trim())
    if (duration >= 5 || endsLine) {
      flush()
    }
  }
  flush()

  return cues
}

export type SubtitleFormat = 'srt' | 'vtt'

export function generateSubtitles(result: TranscriptResult, format: SubtitleFormat): string {
  if (!result.chunks.length) {
    throw new Error('No transcript chunks available to export. Run transcription first.')
  }

  const cues = buildCues(result.chunks)
  if (cues.length === 0) {
    throw new Error('The transcript has no timed chunks. Cannot generate subtitles without timestamps.')
  }

  if (format === 'srt') {
    return cues
      .map(c =>
        `${c.index}\n${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}\n${c.text}`
      )
      .join('\n\n') + '\n'
  }

  const body = cues
    .map(c => `${formatVttTime(c.start)} --> ${formatVttTime(c.end)}\n${c.text}`)
    .join('\n\n')

  return `WEBVTT\n\n${body}\n`
}

export function downloadPlainText(
  result:   TranscriptResult,
  baseName: string,
): void {
  if (!result.text) {
    throw new Error('No transcript text available to export. Run transcription first.')
  }
  const fileName = baseName.replace(/\.[^.]+$/, '') + '.txt'
  const blob     = new Blob([result.text], { type: 'text/plain' })
  const url      = URL.createObjectURL(blob)
  try {
    const a    = document.createElement('a')
    a.href     = url
    a.download = fileName
    a.click()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

export function downloadSubtitles(
  result:   TranscriptResult,
  format:   SubtitleFormat,
  baseName: string,
): void {
  const content  = generateSubtitles(result, format)
  const mimeType = format === 'srt' ? 'text/plain' : 'text/vtt'
  const ext      = format === 'srt' ? '.srt' : '.vtt'
  const fileName = baseName.replace(/\.[^.]+$/, '') + ext
  const blob     = new Blob([content], { type: mimeType })
  const url      = URL.createObjectURL(blob)
  try {
    const a    = document.createElement('a')
    a.href     = url
    a.download = fileName
    a.click()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}
