import type { CaptionGroup } from './captionEngine'

function toTimecode(seconds: number, format: 'srt' | 'vtt'): string {
  // Guard against NaN/Infinity so a corrupted word timestamp never produces
  // literal "NaN" strings in the output that cause players to reject the file.
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  // Work in integer milliseconds so partial-second rounding never produces
  // an ms value of 1000 (e.g. Math.round(0.9995 * 1000) = 1000 is invalid).
  const totalMs = Math.round(seconds * 1000)
  const ms  = totalMs % 1000
  const s   = Math.floor(totalMs / 1000) % 60
  const m   = Math.floor(totalMs / 60000) % 60
  const h   = Math.floor(totalMs / 3600000)
  const sep = format === 'srt' ? ',' : '.'
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(ms).padStart(3, '0')}`
}

export function generateSRT(captionGroups: CaptionGroup[]): string {
  if (!captionGroups || captionGroups.length === 0) return ''
  return captionGroups
    .filter(group => group.words.length > 0)
    .map((group, i) => {
      // Use the group's own startTime/endTime: these are the authoritative bounds
      // set by groupWords() and match what getActiveCaption() uses at render time.
      // Reading words[0].startTime would require optional chaining and a fallback,
      // making the output non-deterministic when a word has a missing timestamp.
      const start = group.startTime
      const end   = group.endTime
      const text  = group.words.map(w => w.text).join(' ')
      return `${i + 1}\n${toTimecode(start, 'srt')} --> ${toTimecode(end, 'srt')}\n${text}`
    })
    .join('\n\n')
}

export function generateVTT(captionGroups: CaptionGroup[]): string {
  if (!captionGroups || captionGroups.length === 0) return ''
  const body = captionGroups
    .filter(group => group.words.length > 0)
    .map((group) => {
      const start = group.startTime
      const end   = group.endTime
      const text  = group.words.map(w => w.text).join(' ')
      return `${toTimecode(start, 'vtt')} --> ${toTimecode(end, 'vtt')}\n${text}`
    })
    .join('\n\n')
  return `WEBVTT\n\n${body}`
}

export function downloadSubtitle(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain' })
  const url  = URL.createObjectURL(blob)
  try {
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    // Append to DOM before clicking: Firefox requires the anchor to be in the
    // document before dispatching the click or the download is silently dropped.
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    // Defer revocation so the browser has time to start the download before
    // the object URL is invalidated.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}
