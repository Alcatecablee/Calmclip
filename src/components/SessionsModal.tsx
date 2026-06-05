import { useRef } from 'react'
import { X, Layers } from 'lucide-react'
import { formatBytes, formatDate } from '../lib/exportHandlers'
import type { SessionData } from '../lib/projectSession'

interface Props {
  sessions:       SessionData[]
  pendingSession: SessionData | null
  currentFile:    File | null
  onLoad:         (session: SessionData) => void
  onDelete:       (key: string) => void
  onClose:        () => void
  onSelectFile:   (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function SessionsModal({
  sessions, pendingSession, currentFile, onLoad, onDelete, onClose, onSelectFile,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.60)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        data-cc-modal
        className="w-full max-w-2xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-hidden"
        style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 24px 48px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.10)' }}
      >
        <div
          data-cc-modal-header
          className="flex items-center justify-between pb-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center" style={{ gap: 2 }}>
            <img src="/logo.png" alt="" aria-hidden="true" style={{ height: 22, width: 22, objectFit: 'contain', flexShrink: 0 }} />
            <img src="/wordmark.png" alt="CalmClip" className="modal-wordmark" style={{ height: 16, width: 'auto', objectFit: 'contain', flexShrink: 0, marginTop: 5 }} />
            <span style={{ fontSize: 11, color: 'var(--text-dim)', paddingLeft: 2 }}>Saved Sessions</span>
          </div>
          <button
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
          >
            <X size={13} />
          </button>
        </div>

        {pendingSession && (
          <div
            className="p-4 rounded-xl text-xs flex flex-col gap-3 border"
            style={{ borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.01)' }}
          >
            <div className="flex flex-col gap-1">
              <div className="font-semibold text-[13px]" style={{ color: 'var(--text-primary)' }}>Matching video required</div>
              <div style={{ color: 'var(--text-muted)' }} className="mt-0.5">
                To restore this session, please select the original file:
              </div>
              <div
                className="font-mono text-xs select-all truncate mt-1 p-2 rounded-lg"
                style={{ color: 'var(--text-primary)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                {(() => {
                  const parts = pendingSession.fileKey.split('__')
                  const name  = parts[0] || 'Unknown video'
                  const size  = parts[1] ? formatBytes(parseInt(parts[1])) : 'Unknown size'
                  return `${name} (${size})`
                })()}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              style={{ display: 'none' }}
              onChange={onSelectFile}
            />

            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                style={{ background: '#ef4444', color: '#fff' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#dc2626' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#ef4444' }}
              >
                Select file
              </button>
              <button
                onClick={onClose}
                className="py-1.5 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-muted)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Layers size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No saved sessions yet</p>
              <p className="text-xs max-w-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Your edit sessions are saved automatically in IndexedDB when you modify video settings.
              </p>
            </div>
          ) : (
            <div className="flex flex-col rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
              {sessions.map((session, index) => {
                const parts     = session.fileKey.split('__')
                const name      = parts[0] || 'Unknown video'
                const size      = parts[1] ? parseInt(parts[1]) : 0
                const isCurrent = currentFile && `${currentFile.name}__${currentFile.size}` === session.fileKey

                return (
                  <div
                    key={session.fileKey}
                    className="p-4 flex items-center justify-between gap-4 transition-colors"
                    style={{
                      borderBottom: index === sessions.length - 1 ? 'none' : '1px solid var(--border)',
                      background:   isCurrent ? 'var(--primary-a4)' : 'transparent',
                    }}
                  >
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }} title={name}>
                          {name}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded" style={{ color: 'var(--primary)', background: 'var(--primary-a10)' }}>
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        <span>{formatBytes(size)}</span>
                        <span>•</span>
                        <span>{formatDate(session.savedAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onLoad(session)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        style={{
                          background: isCurrent ? 'var(--primary-a8)' : 'var(--bg-surface-2)',
                          color:      isCurrent ? 'var(--primary)' : 'var(--text-muted)',
                          border:     `1px solid ${isCurrent ? 'var(--primary-a30)' : 'var(--border)'}`,
                        }}
                        onMouseEnter={e => {
                          if (!isCurrent) {
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'
                            ;(e.currentTarget as HTMLElement).style.color = 'var(--primary)'
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isCurrent) {
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                            ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
                          }
                        }}
                      >
                        {isCurrent ? 'Applied' : 'Load'}
                      </button>
                      <button
                        onClick={() => onDelete(session.fileKey)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer hover:text-[#ef4444]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="pt-3 text-[11px] flex items-center justify-between" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <span>Automatic clean-up deletes sessions older than 7 days.</span>
          <span>100% Client-side.</span>
        </div>
      </div>
    </div>
  )
}
