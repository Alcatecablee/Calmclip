import { RefreshCw } from 'lucide-react'

interface Props {
  onUpdate: () => void
}

export default function UpdateBanner({ onUpdate }: Props) {
  return (
    <div
      role="alert"
      style={{
        position:       'fixed',
        top:            '0',
        left:           '0',
        right:          '0',
        zIndex:         70,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            '12px',
        padding:        '10px 16px',
        background:     'var(--bg-surface)',
        borderBottom:   '1px solid var(--border)',
        fontSize:       '0.85rem',
      }}
    >
      <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.56px', textTransform: 'uppercase' }}>
        Update ready
      </span>
      <span style={{ color: 'var(--text-muted)' }}>A new version of CalmClip is available.</span>
      <button
        onClick={onUpdate}
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '5px',
          background:   'var(--primary)',
          color:        'var(--primary-foreground)',
          border:       'none',
          borderRadius: '4px',
          padding:      '4px 12px',
          fontSize:     '0.8rem',
          fontWeight:   600,
          cursor:       'pointer',
        }}
      >
        <RefreshCw size={12} />
        Update now
      </button>
    </div>
  )
}
