import { Monitor, Clock, HardDrive, FileVideo } from 'lucide-react'

interface PreProps {
  videoWidth:   number
  videoHeight:  number
  trimDuration: number
  fileSize:     number
  hasAudio:     boolean
}

interface PostProps {
  originalSize: number
  exportedSize: number
}

function fmt(s: number): string {
  const m  = Math.floor(s / 60)
  const ss = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}:${ss}`
}

function fmtMB(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function PreExportReport({ videoWidth, videoHeight, trimDuration, fileSize, hasAudio }: PreProps) {
  return (
    <div
      className="rounded-xl p-3 grid grid-cols-2 gap-2"
      style={{ background: 'var(--bg-surface)', border: '1.5px solid var(--border)' }}
    >
      <div className="flex items-center gap-2">
        <Monitor size={11} style={{ color: 'var(--text-faint)' }} />
        <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
          {videoWidth > 0 ? `${videoWidth}x${videoHeight}` : 'Detecting...'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Clock size={11} style={{ color: 'var(--text-faint)' }} />
        <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
          {trimDuration > 0 ? fmt(trimDuration) : '--'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <HardDrive size={11} style={{ color: 'var(--text-faint)' }} />
        <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
          {fmtMB(fileSize)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <FileVideo size={11} style={{ color: 'var(--text-faint)' }} />
        <span className="text-xs" style={{ color: hasAudio ? '#10b981' : 'var(--text-faint)' }}>
          {hasAudio ? 'Has audio' : 'No audio'}
        </span>
      </div>
    </div>
  )
}

export function PostExportReport({ originalSize, exportedSize }: PostProps) {
  if (originalSize === 0) return null
  const saved    = originalSize - exportedSize
  const savedPct = Math.round((saved / originalSize) * 100)
  const bigger   = exportedSize > originalSize

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2"
      style={{ background: 'var(--bg-surface)', border: '1.5px solid var(--border)' }}
    >
      <div className="flex justify-between text-xs">
        <span style={{ color: 'var(--text-faint)' }}>Original</span>
        <span style={{ color: 'var(--text-primary)' }}>{fmtMB(originalSize)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span style={{ color: 'var(--text-faint)' }}>Exported</span>
        <span style={{ color: 'var(--text-primary)' }}>{fmtMB(exportedSize)}</span>
      </div>
      <div
        className="flex justify-between text-xs pt-1 border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <span style={{ color: 'var(--text-faint)' }}>
          {bigger ? 'Size increase' : 'Size saved'}
        </span>
        <span style={{ color: bigger ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
          {bigger ? '+' : '-'}{Math.abs(savedPct)}% ({fmtMB(Math.abs(saved))})
        </span>
      </div>
    </div>
  )
}
