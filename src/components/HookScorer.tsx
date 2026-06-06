import { useMemo, useState } from 'react'
import type { TranscriptResult } from '../lib/whisper'
import { scoreHook } from '../lib/hookScorer'

interface Props {
  transcript: TranscriptResult
}

function ScoreBar({ value }: { value: number }) {
  const color = value >= 70 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
    </div>
  )
}

function SignalRow({ label, pass, detail }: { label: string; pass: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span style={{ color: 'var(--text-faint)' }}>{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span style={{ color: 'var(--text-faint)' }}>{detail}</span>}
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: pass ? '#10b981' : 'var(--border)',
          display: 'inline-block', flexShrink: 0,
        }} />
      </div>
    </div>
  )
}

export default function HookScorer({ transcript }: Props) {
  const [scoreError, setScoreError] = useState<string | null>(null)
  const result = useMemo(() => {
    try {
      setScoreError(null)
      return scoreHook(transcript)
    } catch (err) {
      setScoreError(err instanceof Error ? err.message : String(err))
      return null
    }
  }, [transcript])

  if (scoreError) {
    return (
      <p className="text-xs" style={{ color: '#ef4444' }}>
        Hook scorer error: {scoreError}
      </p>
    )
  }

  if (!result) return null

  const label =
    result.score >= 70 ? 'Strong hook'
    : result.score >= 40 ? 'Decent hook'
    : 'Weak hook'

  const labelColor =
    result.score >= 70 ? '#10b981'
    : result.score >= 40 ? '#f59e0b'
    : '#ef4444'

  if (result.hookChunks === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        No speech detected in the first 30 seconds.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>First 30 seconds</span>
        <span className="text-xs font-semibold" style={{ color: labelColor }}>{result.score}/100 {label}</span>
      </div>

      <ScoreBar value={result.score} />

      <div className="flex flex-col gap-1.5 pt-1">
        <SignalRow label="Starts talking right away" pass={result.startsImmediately} />
        <SignalRow label="Opens with a question" pass={result.hasQuestion} />
        <SignalRow label="Addresses the viewer directly" pass={result.hasDirectAddress} />
        <SignalRow label="Power words" pass={result.powerCount > 0} detail={result.powerCount > 0 ? `${result.powerCount} found` : 'none'} />
        <SignalRow label="Pace" pass={result.hookWPM >= 80 && result.hookWPM <= 220} detail={result.hookWPM > 0 ? `${result.hookWPM} WPM` : ''} />
      </div>

      {result.foundPower.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {result.foundPower.map(w => (
            <span
              key={w}
              className="text-xs px-2 py-0.5"
              style={{ background: 'var(--primary-a10)', color: 'var(--primary)', borderRadius: 4 }}
            >
              {w}
            </span>
          ))}
        </div>
      )}

      {result.firstLine && (
        <p className="text-xs italic" style={{ color: 'var(--text-faint)', borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
          "{result.firstLine}{result.firstLine.length >= 90 ? '...' : ''}"
        </p>
      )}
    </div>
  )
}
