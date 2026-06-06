import { useMemo, useState } from 'react'
import type { TranscriptResult } from '../lib/whisper'
import { analyzePace, type PaceBucket } from '../lib/paceAnalyzer'

const TIER_COLOR: Record<PaceBucket['tier'], string> = {
  slow:  '#f59e0b',
  ok:    '#4ade80',
  fast:  '#f59e0b',
  rush:  '#ef4444',
}

const TIER_LABEL: Record<PaceBucket['tier'], string> = {
  slow:  'Slow',
  ok:    'Good',
  fast:  'Fast',
  rush:  'Very fast',
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

interface Props {
  transcript: TranscriptResult | null
  onSeek:     (time: number) => void
}

export default function PaceAnalyzer({ transcript, onSeek }: Props) {
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const buckets = useMemo(() => {
    try {
      setAnalyzeError(null)
      return analyzePace(transcript)
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : String(err))
      return [] as PaceBucket[]
    }
  }, [transcript])

  if (analyzeError) {
    return (
      <p className="text-xs" style={{ color: '#ef4444' }}>
        Pace analyzer error: {analyzeError}
      </p>
    )
  }

  if (buckets.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Not enough timestamp data to analyze pace.
      </p>
    )
  }

  const avgWpm = Math.round(buckets.reduce((s, b) => s + b.wpm, 0) / buckets.length)
  const slowCount = buckets.filter(b => b.tier === 'slow').length
  const rushCount = buckets.filter(b => b.tier === 'rush').length

  const overallTier: PaceBucket['tier'] =
    rushCount > buckets.length * 0.3 ? 'rush'
    : slowCount > buckets.length * 0.3 ? 'slow'
    : avgWpm >= 180 ? 'fast'
    : 'ok'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          Words per minute over time. Optimal range is 100-180 WPM.
        </p>
        <span
          className="text-xs font-mono px-2 py-0.5 rounded"
          style={{
            background: `${TIER_COLOR[overallTier]}18`,
            color: TIER_COLOR[overallTier],
            border: `1px solid ${TIER_COLOR[overallTier]}40`,
          }}
        >
          avg {avgWpm} WPM
        </span>
      </div>

      <div
        className="flex rounded-lg overflow-hidden"
        style={{ height: 28, gap: 2 }}
      >
        {buckets.map((b, i) => (
          <button
            key={i}
            onClick={() => onSeek(b.start)}
            title={`${fmt(b.start)} - ${b.wpm} WPM (${TIER_LABEL[b.tier]})`}
            style={{
              flex: b.end - b.start,
              background: `${TIER_COLOR[b.tier]}${b.tier === 'ok' ? '28' : '40'}`,
              border: `1px solid ${TIER_COLOR[b.tier]}50`,
              borderRadius: 3,
              cursor: 'pointer',
              position: 'relative',
              minWidth: 4,
              transition: 'opacity 0.1s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.7')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
          />
        ))}
      </div>

      <div className="flex gap-3">
        {(['slow', 'ok', 'fast', 'rush'] as PaceBucket['tier'][]).map(tier => (
          <div key={tier} className="flex items-center gap-1.5">
            <div
              style={{
                width: 8, height: 8, borderRadius: 2,
                background: TIER_COLOR[tier],
                opacity: 0.7,
              }}
            />
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {TIER_LABEL[tier]}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
        {buckets.filter(b => b.tier !== 'ok').map((b, i) => (
          <button
            key={i}
            onClick={() => onSeek(b.start)}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-left w-full"
            style={{
              background: `${TIER_COLOR[b.tier]}08`,
              border: `1px solid ${TIER_COLOR[b.tier]}25`,
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                color: TIER_COLOR[b.tier],
                minWidth: 36,
              }}
            >
              {fmt(b.start)}
            </span>
            <span className="text-xs flex-1" style={{ color: 'var(--text-faint)' }}>
              {b.wpm} WPM
            </span>
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {TIER_LABEL[b.tier]}
            </span>
          </button>
        ))}
        {buckets.every(b => b.tier === 'ok') && (
          <p className="text-xs" style={{ color: '#4ade80' }}>
            Excellent pacing throughout. All sections within the optimal range.
          </p>
        )}
      </div>
    </div>
  )
}
