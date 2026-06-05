import { EyeOff, VolumeX, Maximize2, Volume2 } from 'lucide-react'

const FEATURES = [
  {
    Icon: EyeOff,
    label: 'Privacy-safe face blur',
    desc: 'WASM-powered detection draws blur regions without any cloud processing.',
    featured: true,
  },
  {
    Icon: VolumeX,
    label: 'Silence removal',
    desc: 'Strip dead air and long pauses automatically. Keeps recordings tight.',
    featured: false,
  },
  {
    Icon: Maximize2,
    label: 'Resize to any ratio',
    desc: '16:9, 9:16, 1:1, and 4:5 with fit or fill crop. Batch all ratios in one click.',
    featured: false,
  },
  {
    Icon: Volume2,
    label: 'Loudness normalization',
    desc: 'EBU R128 and YouTube loudness targets for consistent, broadcast-ready audio.',
    featured: false,
  },
]

export default function LandingFeatures() {
  return (
    <div style={{ width: '100%', maxWidth: 820, marginTop: 88 }}>
      <span className="landing-eyebrow">Features</span>
      <h2 style={{
        fontSize: 28,
        fontWeight: 700,
        color: 'var(--text-primary)',
        letterSpacing: '-0.035em',
        textAlign: 'center',
        margin: '0 0 10px 0',
        lineHeight: 1.18,
      }}>
        Powerful tools, zero complexity
      </h2>
      <p style={{
        fontSize: 14,
        color: 'var(--text-dim)',
        textAlign: 'center',
        margin: '0 0 32px auto',
        marginLeft: 'auto',
        marginRight: 'auto',
        lineHeight: 1.7,
        maxWidth: 480,
      }}>
        Silence removal, face blur, resize, and loudness: all running locally on your device.
      </p>
      <div className="features-grid">
        {FEATURES.map((f, i) => {
          const Icon = f.Icon
          return (
            <div
              key={i}
              className="landing-card-hover"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                padding: '26px 22px',
                background: 'var(--bg-surface)',
                border: f.featured ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                borderRadius: 14,
                boxShadow: f.featured ? '0 2px 8px var(--primary-a10)' : '0 1px 4px rgba(0,0,0,0.05)',
              }}
            >
              <Icon size={15} color="var(--primary)" />
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
              }}>
                {f.label}
              </span>
              <span style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                lineHeight: 1.65,
              }}>
                {f.desc}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
