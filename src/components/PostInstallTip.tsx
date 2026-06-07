import { useState } from 'react'
import { X, MousePointerClick } from 'lucide-react'

const SEEN_KEY = 'calmclip-post-install-seen'

export default function PostInstallTip() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(SEEN_KEY))

  if (!visible) return null

  function dismiss() {
    localStorage.setItem(SEEN_KEY, '1')
    setVisible(false)
  }

  return (
    <div
      role="status"
      style={{
        position:     'fixed',
        bottom:       '16px',
        left:         '50%',
        transform:    'translateX(-50%)',
        zIndex:       60,
        display:      'flex',
        alignItems:   'flex-start',
        gap:          '12px',
        padding:      '14px 16px',
        background:   'var(--bg-surface)',
        border:       '1px solid var(--border)',
        borderRadius: '4px',
        boxShadow:    '0 8px 32px rgba(0,0,0,0.45)',
        maxWidth:     '420px',
        width:        'calc(100vw - 32px)',
      }}
    >
      <div
        style={{
          width:        32,
          height:       32,
          borderRadius: '50%',
          background:   'var(--primary-a12)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          flexShrink:   0,
          marginTop:    2,
        }}
      >
        <MousePointerClick size={15} color="var(--primary)" />
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{
          fontSize:     '0.85rem',
          fontWeight:   600,
          color:        'var(--text-primary)',
          marginBottom: '6px',
          lineHeight:   1.3,
        }}>
          You're set up!
        </p>
        <p style={{
          fontSize:   '0.75rem',
          color:      'var(--text-muted)',
          lineHeight: 1.55,
          margin:     0,
        }}>
          Right-click any video file on your desktop, choose
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}> Open with </span>
          and select CalmClip. Check
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}> "Remember my choice" </span>
          to make it instant every time.
        </p>
      </div>

      <button
        onClick={dismiss}
        aria-label="Dismiss tip"
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
