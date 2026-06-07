import { AudioLines, Loader2, CheckCircle2, AlertCircle, Scissors } from 'lucide-react'
import { detectSilence, type SilenceSegment } from '../lib/silenceCutter'
import { recordToolUsage } from '../lib/projectSession'

export type SilencePhase = 'idle' | 'detecting' | 'done' | 'error'

export interface SilenceScanState {
  phase:    SilencePhase
  segments: SilenceSegment[]
  error:    string | null
  noiseDb:  number
  minDur:   number
}

export const SILENCE_SCAN_DEFAULT: SilenceScanState = {
  phase:    'idle',
  segments: [],
  error:    null,
  noiseDb:  -50,
  minDur:   1.0,
}

interface Props {
  file:           File | null
  trimStart:      number
  trimEnd:        number
  hasAudio:       boolean
  removeSilence:  boolean
  onToggle:       (v: boolean) => void
  onSegments:     (segs: SilenceSegment[]) => void
  scanState:      SilenceScanState
  onScanState:    (s: SilenceScanState) => void
}

export default function SilenceCutterPanel({
  file, trimStart, trimEnd, hasAudio, removeSilence,
  onToggle, onSegments, scanState, onScanState,
}: Props) {
  const { phase, segments, error, noiseDb, minDur } = scanState

  if (!hasAudio && file) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        No audio track detected in this video. Silence detection is not available.
      </p>
    )
  }

  async function handleDetect() {
    if (!file) return
    // Capture slider values at click time so the post-await update is consistent.
    const db  = noiseDb
    const dur = minDur
    onScanState({ ...scanState, phase: 'detecting', error: null })
    recordToolUsage('silenceCut').catch(() => {})
    try {
      const segs = await detectSilence(file, trimStart, trimEnd, db, dur)
      onScanState({ phase: 'done', segments: segs, error: null, noiseDb: db, minDur: dur })
      onSegments(segs)
    } catch (e) {
      onScanState({ phase: 'error', segments: [], error: e instanceof Error ? e.message : 'Detection failed.', noiseDb: db, minDur: dur })
    }
  }

  function fmt(s: number): string {
    const m  = Math.floor(s / 60)
    const ss = (s % 60).toFixed(1).padStart(4, '0')
    return `${m}:${ss}`
  }

  const totalSilence = segments.reduce((acc, s) => acc + (s.end - s.start), 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Noise Threshold</span>
            <span className="font-mono" style={{ color: 'var(--primary)' }}>{noiseDb} dB</span>
          </div>
          <input
            type="range"
            min={-60}
            max={-30}
            step={5}
            value={noiseDb}
            disabled={phase === 'detecting'}
            onChange={e => onScanState({ ...scanState, noiseDb: parseInt(e.target.value, 10) })}
            className="w-full h-1 rounded outline-none cursor-pointer accent-primary"
            style={{ background: 'var(--border)' }}
          />
          <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span>-60 dB (quieter)</span>
            <span>-30 dB (louder)</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Minimum Gap Duration</span>
            <span className="font-mono" style={{ color: 'var(--primary)' }}>{minDur.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={0.3}
            max={3.0}
            step={0.1}
            value={minDur}
            disabled={phase === 'detecting'}
            onChange={e => onScanState({ ...scanState, minDur: parseFloat(e.target.value) })}
            className="w-full h-1 rounded outline-none cursor-pointer accent-primary"
            style={{ background: 'var(--border)' }}
          />
          <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span>0.3s</span>
            <span>3.0s</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleDetect}
        disabled={phase === 'detecting' || !file}
        className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-all"
        style={{
          background: phase === 'detecting' ? 'var(--primary-a8)' : 'var(--bg-surface)',
          border:     `1px solid ${phase === 'detecting' ? 'var(--primary)' : 'var(--border)'}`,
          color:      phase === 'detecting' ? 'var(--primary)' : 'var(--text-muted)',
          cursor:     phase === 'detecting' || !file ? 'default' : 'pointer',
          width:      '100%',
        }}
        title="Scan the trimmed clip for pauses and list them"
      >
        {phase === 'detecting'
          ? <Loader2 size={13} className="animate-spin" />
          : phase === 'done'
          ? <CheckCircle2 size={13} color="#10b981" />
          : <AudioLines size={13} />
        }
        {phase === 'idle'      && 'Detect silent gaps'}
        {phase === 'detecting' && 'Analyzing audio...'}
        {phase === 'done'      && `${segments.length} gap${segments.length !== 1 ? 's' : ''} found`}
        {phase === 'error'     && 'Retry detection'}
      </button>

      {phase === 'error' && error && (
        <div className="flex items-start gap-2 text-xs p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
          <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {phase === 'done' && segments.length > 0 && (
        <>
          <div
            className="rounded-lg p-2 flex flex-col gap-1"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', maxHeight: 110, overflowY: 'auto' }}
          >
            {segments.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-primary)' }}>{fmt(s.start)} to {fmt(s.end)}</span>
                <span style={{ color: 'var(--text-muted)' }}>{(s.end - s.start).toFixed(1)}s</span>
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Total silence: {totalSilence.toFixed(1)}s
          </p>
          <button
            onClick={() => onToggle(!removeSilence)}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-all"
            style={{
              background: removeSilence ? 'var(--primary-a10)' : 'var(--bg-surface)',
              border:     `1px solid ${removeSilence ? 'var(--primary)' : 'var(--border)'}`,
              color:      removeSilence ? 'var(--primary)' : 'var(--text-muted)',
              cursor:     'pointer',
            }}
            title="Cut all detected silent gaps out of the video at export time"
          >
            <Scissors size={11} />
            {removeSilence ? 'Remove silent gaps at export (on)' : 'Remove silent gaps at export'}
          </button>
        </>
      )}

      {phase === 'done' && segments.length === 0 && (
        <p className="text-xs" style={{ color: '#10b981' }}>No significant silence detected.</p>
      )}

      {phase === 'idle' && (
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
          Scans the trimmed segment for pauses longer than {minDur.toFixed(1)}s.
        </p>
      )}
    </div>
  )
}
