import type { CaptionGroup } from './captionEngine'

function toTimecode(seconds: number, format: 'srt' | 'vtt'): string {
  // Work in integer milliseconds so partial-second rounding never produces
  // an ms value of 1000 (e.g. Math.round(0.9995 * 1000) = 1000 is invalid).
  const totalMs = Math.round(Math.max(0, seconds) * 1000)
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
    .map((group, i) => {
      const start = group.words[0]?.startTime ?? 0
      const end   = group.words[group.words.length - 1]?.endTime ?? start + 1
      const text  = group.words.map(w => w.text).join(' ')
      return `${i + 1}\n${toTimecode(start, 'srt')} --> ${toTimecode(end, 'srt')}\n${text}`
    })
    .join('\n\n')
}

export function generateVTT(captionGroups: CaptionGroup[]): string {
  if (!captionGroups || captionGroups.length === 0) return ''
  const body = captionGroups
    .map((group) => {
      const start = group.words[0]?.startTime ?? 0
      const end   = group.words[group.words.length - 1]?.endTime ?? start + 1
      const text  = group.words.map(w => w.text).join(' ')
      return `${toTimecode(start, 'vtt')} --> ${toTimecode(end, 'vtt')}\n${text}`
    })
    .join('\n\n')
  return `WEBVTT\n\n${body}`
}

export function downloadSubtitle(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revocation so the browser has time to begin the download
  // before the object URL is invalidated. Mirrors the pattern in subtitleExport.ts.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
