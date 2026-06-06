import type { TranscriptResult } from './whisper'

export interface PaceBucket {
  start: number
  end:   number
  wpm:   number
  tier:  'slow' | 'ok' | 'fast' | 'rush'
}

export function analyzePace(result: TranscriptResult | null, windowSec = 15): PaceBucket[] {
  if (!result) return []
  const chunks = result.chunks.filter(
    c => c.timestamp[0] != null && c.timestamp[1] != null,
  )
  if (chunks.length < 2) return []

  const first = chunks[0].timestamp[0]!
  const last  = chunks[chunks.length - 1].timestamp[1]!
  if (last <= first) return []

  const buckets: PaceBucket[] = []

  for (let t = first; t < last; t += windowSec) {
    const windowEnd = Math.min(t + windowSec, last)
    const inWindow  = chunks.filter(
      c => c.timestamp[0]! >= t && c.timestamp[0]! < windowEnd,
    )
    const wordCount = inWindow.reduce(
      (sum, c) => sum + (c.text ?? '').trim().split(/\s+/).filter(Boolean).length, 0,
    )
    const durationMin = (windowEnd - t) / 60
    const wpm = durationMin > 0 ? Math.round(wordCount / durationMin) : 0

    let tier: PaceBucket['tier']
    if      (wpm < 100) tier = 'slow'
    else if (wpm < 180) tier = 'ok'
    else if (wpm < 220) tier = 'fast'
    else                tier = 'rush'

    buckets.push({ start: t, end: windowEnd, wpm, tier })
  }
  return buckets
}
