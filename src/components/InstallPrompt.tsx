import { Download, X } from 'lucide-react'

interface Props {
  onInstall: () => void
  onDismiss: () => void
}

export default function InstallPrompt({ onInstall, onDismiss }: Props) {
  return (
    <div
      role="banner"
      style={{
        position:     'fixed',
        bottom:       '16px',
        left:         '50%',
        transform:    'translateX(-50%)',
        zIndex:       60,
        display:      'flex',
        alignItems:   'center',
        gap:          '12px',
        padding:      '12px 16px',
        background:   'var(--bg-surface)',
        border:       '1px solid var(--border)',
        borderRadius: '4px',
        boxShadow:    '0 8px 32px rgba(0,0,0,0.45)',
        maxWidth:     'calc(100vw - 32px)',
        width:        'max-content',
      }}
    >
      <img src="/logo.png" alt="" width={36} height={36} style={{ borderRadius: '4px', flexShrink: 0, objectFit: 'contain' }} />

      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
          Right-click. Edit. Export.
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          CalmClip lives in your browser.
        </p>
      </div>

      <button
        onClick={onInstall}
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '6px',
          background:   'var(--primary)',
          color:        'var(--primary-foreground)',
          border:       'none',
          borderRadius: '4px',
          padding:      '7px 14px',
          fontSize:     '0.8rem',
          fontWeight:   600,
          cursor:       'pointer',
          whiteSpace:   'nowrap',
          flexShrink:   0,
        }}
      >
        <Download size={13} />
        Add to Desktop
      </button>

      <button
        onClick={onDismiss}
        aria-label="Dismiss install prompt"
        style={{
          background: 'transparent',
          border:     'none',
          color:      'var(--text-muted)',
          cursor:     'pointer',
          padding:    '4px',
          display:    'flex',
          flexShrink: 0,
        }}
      >
        <X size={15} />
      </button>
    </div>
  )
}
