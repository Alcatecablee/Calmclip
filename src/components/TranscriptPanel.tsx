import { useState } from 'react'
import { Download } from 'lucide-react'
import type { TranscriptResult } from '../lib/whisper'
import { downloadSubtitles } from '../lib/subtitleExport'

interface Props {
  result:   TranscriptResult
  onSeek:   (time: number) => void
  fileName: string
}

export default function TranscriptPanel({ result, onSeek, fileName }: Props) {
  const [exportError, setExportError] = useState<string | null>(null)

  if (!result.chunks.length && !result.text) return null

  function handleExport(format: 'srt' | 'vtt') {
    setExportError(null)
    try {
      downloadSubtitles(result, format, fileName)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Subtitle export failed.')
    }
  }

  const hasTimestamps = result.chunks.some(c => c.timestamp[0] != null)

  return (
    <div className="flex flex-col gap-2">
      {result.chunks.length === 0 ? (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-faint)' }}>
          {result.text}
        </p>
      ) : (
        <>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            Click any word to jump to that moment.
          </p>
          <div
            className="rounded-lg p-3 leading-loose text-sm"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', maxHeight: 160, overflowY: 'auto' }}
          >
            {result.chunks.map((chunk, i) => {
              const time = chunk.timestamp[0]
              return (
                <span
                  key={i}
                  onClick={() => time != null && onSeek(time)}
                  style={{
                    color:        'var(--text-muted)',
                    cursor:       time != null ? 'pointer' : 'default',
                    borderRadius: 3,
                    padding:      '1px 2px',
                    transition:   'background 0.1s',
                  }}
                  onMouseEnter={e => {
                    if (time != null)(e.target as HTMLSpanElement).style.background = 'var(--primary-a10)'
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLSpanElement).style.background = 'transparent'
                  }}
                  title={time != null ? `${time.toFixed(1)}s` : ''}
                >
                  {chunk.text ?? ''}
                </span>
              )
            })}
          </div>
        </>
      )}

      {hasTimestamps && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
            Export subtitles:
          </span>
          <button
            onClick={() => handleExport('srt')}
            className="flex items-center gap-1.5"
            style={{
              fontSize: 11, fontWeight: 500, color: 'var(--text-muted)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
            }}
          >
            <Download size={11} />
            SRT
          </button>
          <button
            onClick={() => handleExport('vtt')}
            className="flex items-center gap-1.5"
            style={{
              fontSize: 11, fontWeight: 500, color: 'var(--text-muted)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
            }}
          >
            <Download size={11} />
            VTT
          </button>
        </div>
      )}

      {exportError && (
        <p className="text-xs" style={{ color: '#ef4444' }}>
          {exportError}
        </p>
      )}
    </div>
  )
}
