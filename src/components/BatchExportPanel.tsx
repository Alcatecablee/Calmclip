import { Package, CheckCircle2, Loader2 } from 'lucide-react'
import type { BatchProgress } from '../lib/batchExport'
import type { Ratio } from '../lib/ffmpeg'

interface Props {
  running:  boolean
  progress: BatchProgress[]
  onClick:  () => void
  disabled: boolean
}

const RATIO_LABELS: Record<Ratio, string> = {
  '16:9': 'YouTube',
  '9:16': 'TikTok / Reels',
  '1:1':  'Instagram Square',
  '4:5':  'Instagram Portrait',
}

export default function BatchExportPanel({ running, progress, onClick, disabled }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={onClick}
        disabled={disabled || running}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-all"
        style={{
          background: disabled || running ? 'var(--bg-surface)' : 'var(--bg-surface)',
          border:     `1.5px solid ${disabled || running ? 'var(--border)' : 'var(--border)'}`,
          color:      disabled || running ? 'var(--text-faint)' : 'var(--text-muted)',
          cursor:     disabled || running ? 'not-allowed' : 'pointer',
        }}
      >
        {running
          ? <><Loader2 size={13} className="animate-spin" /> Exporting all ratios...</>
          : <><Package size={13} /> Export all 4 ratios (16:9, 9:16, 1:1, 4:5)</>
        }
      </button>

      {running && progress.length > 0 && (
        <div className="flex flex-col gap-1.5 pl-1">
          {progress.map(p => (
            <div key={p.ratio} className="flex items-center gap-2 text-xs">
              {p.done
                ? <CheckCircle2 size={11} color="#10b981" />
                : p.percent > 0
                  ? <Loader2 size={11} style={{ color: 'var(--primary)' }} className="animate-spin" />
                  : <div style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--border)' }} />
              }
              <span style={{ color: p.done ? '#10b981' : p.percent > 0 ? 'var(--primary)' : 'var(--text-faint)', minWidth: 40 }}>
                {p.ratio}
              </span>
              <span style={{ color: 'var(--text-faint)' }}>{RATIO_LABELS[p.ratio]}</span>
              {!p.done && p.percent > 0 && (
                <span style={{ color: 'var(--text-faint)', marginLeft: 'auto' }}>{p.percent}%</span>
              )}
              {p.done && (
                <span style={{ color: '#10b981', marginLeft: 'auto' }}>Done</span>
              )}
            </div>
          ))}
        </div>
      )}

      {!running && !disabled && (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          Downloads 4 separate files, one per ratio. Useful for posting the same clip across platforms.
        </p>
      )}
    </div>
  )
}
