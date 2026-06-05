import { Sparkles } from 'lucide-react'

interface Props {
  label:     string
  onUpgrade: () => void
  children:  React.ReactNode
  isPro:     boolean
}

export default function ProGate({ label, onUpgrade, children, isPro }: Props) {
  if (isPro) return <>{children}</>

  return (
    <div
      style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}
      aria-label={`${label}. Pro feature.`}
    >
      <div style={{ pointerEvents: 'none', userSelect: 'none', opacity: 0.55 }}>
        {children}
      </div>

      <div
        style={{
          position:       'absolute',
          inset:          0,
          display:        'flex',
          flexDirection:  'column',
          justifyContent: 'flex-end',
          alignItems:     'center',
          gap:            8,
          paddingBottom:  12,
          background:     'linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--bg-page) 78%, transparent) 42%, color-mix(in srgb, var(--bg-page) 97%, transparent) 65%)',
        }}
      >
        <div
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        4,
            background: 'var(--primary)',
            borderRadius: 5,
            padding:    '3px 8px 3px 6px',
          }}
        >
          <Sparkles size={10} color="#ffffff" />
          <span style={{ fontSize: 10, color: '#ffffff', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Pro
          </span>
        </div>
        <button onClick={onUpgrade} className="progate-upgrade-btn">
          Unlock to use
        </button>
      </div>
    </div>
  )
}
