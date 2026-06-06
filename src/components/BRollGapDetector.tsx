import { useMemo, useState } from 'react'
import { Film, Check, Download } from 'lucide-react'
import type { TranscriptResult } from '../lib/whisper'
import type { SilenceSegment } from '../lib/silenceCutter'
import { detectGaps, exportCueSheet, type Gap } from '../lib/brollGapDetector'

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

interface Props {
  transcript:   TranscriptResult | null
  trimStart:    number
  trimEnd:      number
  silenceSegs:  SilenceSegment[]
  onSeek:       (time: number) => void
  onProGate?:   () => void
}

export default function BRollGapDetector({ transcript, trimStart, trimEnd, silenceSegs, onSeek, onProGate }: Props) {
  const [threshold, setThreshold] = useState(45)
  const [noted,     setNoted]     = useState<Set<string>>(new Set())

  const [detectError, setDetectError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const gaps = useMemo(() => {
    try {
      setDetectError(null)
      if (!transcript) return []
      return detectGaps(transcript, trimStart, trimEnd, silenceSegs, threshold)
    } catch (err) {
      setDetectError(err instanceof Error ? err.message : String(err))
      return [] as Gap[]
    }
  }, [transcript, trimStart, trimEnd, silenceSegs, threshold])

  function toggleNoted(key: string) {
    setNoted(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (detectError) {
    return (
      <p className="text-xs" style={{ color: '#ef4444' }}>
        B-roll detector error: {detectError}
      </p>
    )
  }

  if (!transcript) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Run transcription first to detect sections that may need B-roll footage.
      </p>
    )
  }

  const activeGaps = gaps.filter(g => {
    const key = `${g.start.toFixed(0)}-${g.end.toFixed(0)}`
    return !noted.has(key)
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          Sections longer than:
        </p>
        <div className="flex gap-1">
          {[30, 45, 60, 90].map(s => (
            <button
              key={s}
              onClick={() => setThreshold(s)}
              className="text-xs px-2 py-0.5 rounded"
              style={{
                background: threshold === s ? 'var(--primary-a10)' : 'var(--bg-surface)',
                border:     `1px solid ${threshold === s ? 'var(--primary)' : 'var(--border)'}`,
                color:      threshold === s ? 'var(--primary)' : 'var(--text-faint)',
                cursor:     'pointer',
              }}
            >
              {s}s
            </button>
          ))}
        </div>
      </div>

      {activeGaps.length === 0 ? (
        <div
          className="flex items-center gap-2 p-3 rounded-lg text-xs"
          style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', color: '#4ade80' }}
        >
          <Check size={12} />
          No long uncut sections found at {threshold}s threshold. Good pacing.
        </div>
      ) : (
        <>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {activeGaps.length} section{activeGaps.length !== 1 ? 's' : ''} without a cut. Consider adding B-roll here.
          </p>
          <div className="flex flex-col gap-2">
            {activeGaps.map((g, i) => {
              const key = `${g.start.toFixed(0)}-${g.end.toFixed(0)}`
              const isNoted = noted.has(key)
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{
                    background: isNoted ? 'rgba(74,222,128,0.05)' : 'rgba(245,158,11,0.06)',
                    border:     `1px solid ${isNoted ? 'rgba(74,222,128,0.15)' : 'rgba(245,158,11,0.2)'}`,
                  }}
                >
                  <Film size={12} style={{ color: isNoted ? '#4ade80' : '#f59e0b', flexShrink: 0 }} />

                  <button
                    onClick={() => onSeek(g.start)}
                    className="text-xs font-mono flex-1 text-left"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: isNoted ? 'var(--text-faint)' : 'var(--text-muted)',
                      textDecoration: isNoted ? 'line-through' : 'none',
                    }}
                  >
                    {fmt(g.start)} - {fmt(g.end)}
                    <span style={{ color: 'var(--text-faint)', marginLeft: 6 }}>
                      ({Math.round(g.duration)}s)
                    </span>
                  </button>

                  <button
                    onClick={() => toggleNoted(key)}
                    className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                    style={{
                      background: isNoted ? 'rgba(74,222,128,0.1)' : 'var(--primary-a8)',
                      border:     `1px solid ${isNoted ? 'rgba(74,222,128,0.25)' : 'var(--primary-a20)'}`,
                      color:      isNoted ? '#4ade80' : 'var(--primary)',
                      cursor:     'pointer',
                    }}
                    title={isNoted ? 'Mark as needs B-roll' : 'Mark as noted / intentional'}
                  >
                    {isNoted ? 'Undo' : 'Noted'}
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {gaps.length > 0 && (
        <button
          onClick={() => {
            if (onProGate) { onProGate(); return }
            try {
              setExportError(null)
              exportCueSheet(gaps, noted, threshold)
            } catch (err) {
              setExportError(err instanceof Error ? err.message : String(err))
            }
          }}
          className="flex items-center gap-2 text-xs w-full justify-center rounded-lg"
          style={{
            padding:    '7px 12px',
            background: 'var(--bg-surface)',
            border:     '1px solid var(--border)',
            color:      'var(--text-muted)',
            cursor:     'pointer',
            marginTop:  2,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--primary)'
            e.currentTarget.style.color       = 'var(--primary)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color       = 'var(--text-muted)'
          }}
        >
          <Download size={11} />
          Export cue sheet (.csv)
          {onProGate && <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', background: 'var(--primary-a10)', color: 'var(--primary)', borderRadius: 3, padding: '1px 5px' }}>PRO</span>}
        </button>
      )}

      {exportError && (
        <p className="text-xs" style={{ color: '#ef4444' }}>
          Export failed: {exportError}
        </p>
      )}
    </div>
  )
}
