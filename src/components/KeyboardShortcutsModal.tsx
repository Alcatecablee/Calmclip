import { X } from 'lucide-react'

interface Props {
  onClose: () => void
}

interface ShortcutRow {
  keys: string[]
  description: string
}

interface ShortcutGroup {
  label: string
  rows: ShortcutRow[]
}

const GROUPS: ShortcutGroup[] = [
  {
    label: 'Playback',
    rows: [
      { keys: ['Space'],       description: 'Play or pause' },
      { keys: ['J'],           description: 'Seek back 5 seconds' },
      { keys: ['L'],           description: 'Seek forward 5 seconds' },
      { keys: ['Left arrow'],  description: 'Step back one frame' },
      { keys: ['Right arrow'], description: 'Step forward one frame' },
    ],
  },
  {
    label: 'Trim points',
    rows: [
      { keys: ['['],  description: 'Set trim start at current playhead position' },
      { keys: [']'],  description: 'Set trim end at current playhead position' },
    ],
  },
  {
    label: 'Cuts',
    rows: [
      { keys: ['M'],                  description: 'Add a manual cut at the current playhead position' },
      { keys: ['Ctrl', 'Z'],          description: 'Undo the last manual cut' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo the last undone manual cut' },
    ],
  },
  {
    label: 'App',
    rows: [
      { keys: ['?'], description: 'Open or close this shortcuts panel' },
    ],
  },
]

function Kbd({ label }: { label: string }) {
  return <span className="kbd-key">{label}</span>
}

export default function KeyboardShortcutsModal({ onClose }: Props) {
  const closeButtonStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--bg-surface)',
    color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0,
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.60)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        data-cc-modal
        className="w-full max-w-sm flex flex-col overflow-hidden"
        style={{
          background: 'var(--bg-page)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 24px 48px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.10)',
        }}
      >
        <div
          data-cc-modal-header
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center" style={{ gap: 2 }}>
            <img src="/logo.png" alt="" aria-hidden="true" style={{ height: 22, width: 22, objectFit: 'contain', flexShrink: 0 }} />
            <img src="/wordmark.png" alt="CalmClip" className="modal-wordmark" style={{ height: 16, width: 'auto', objectFit: 'contain', flexShrink: 0, marginTop: 5 }} />
            <span style={{ fontSize: 11, color: 'var(--text-dim)', paddingLeft: 2 }}>Keyboard shortcuts</span>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>
            <X size={13} />
          </button>
        </div>

        <div className="flex flex-col" style={{ overflowY: 'auto', maxHeight: '70vh' }}>
          {GROUPS.map((group, gi) => (
            <div
              key={group.label}
              style={{ borderBottom: gi < GROUPS.length - 1 ? '1px solid var(--border)' : 'none' }}
            >
              <div className="px-5 py-2" style={{ background: 'var(--bg-surface)' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                  {group.label}
                </span>
              </div>
              {group.rows.map(row => (
                <div
                  key={row.description}
                  className="flex items-center justify-between gap-4 px-5 py-2.5"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {row.description}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {row.keys.map((k, ki) => (
                      <span key={ki} className="flex items-center gap-1">
                        <Kbd label={k} />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.5 }}>
              Shortcuts are inactive while typing in a text field.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
