import { EyeOff, VolumeX, Maximize2, Volume2 } from 'lucide-react'

const FEATURES = [
  {
    Icon: EyeOff,
    label: 'Privacy-safe face blur',
    desc: 'Detects faces in the browser and lets you adjust the blur regions before exporting. No frames are sent anywhere.',
    featured: true,
  },
  {
    Icon: VolumeX,
    label: 'Silence removal',
    desc: 'Scans the audio and cuts the dead air. Works well on recorded calls, lectures, and interviews.',
    featured: false,
  },
  {
    Icon: Maximize2,
    label: 'Resize to any ratio',
    desc: 'Export to landscape, vertical, square, or 4:5 from a single source file. Fit or fill crop, your choice.',
    featured: false,
  },
  {
    Icon: Volume2,
    label: 'Loudness normalization',
    desc: 'Brings peaky or quiet audio to a consistent level. Good for podcasts, tutorials, and anything going to YouTube.',
    featured: false,
  },
]

export default function LandingFeatures() {
  return (
    <div style={{ width: '100%', maxWidth: 820, marginTop: 88 }}>
      <span className="landing-eyebrow">Features</span>
      <h2 style={{
        fontSize: 30,
        fontWeight: 700,
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        color: 'var(--text-primary)',
        letterSpacing: '-0.035em',
        margin: '0 0 8px 0',
        lineHeight: 1.18,
      }}>
        The tools you actually reach for
      </h2>
      <p style={{
        fontSize: 13,
        color: 'var(--text-dim)',
        marginTop: 0,
        marginBottom: 40,
        lineHeight: 1.75,
        maxWidth: 460,
      }}>
        Four tools that cover most editing jobs. None of them touch a server.
      </p>

      <div style={{ width: '100%' }}>
        {FEATURES.map((f, i) => {
          const Icon = f.Icon
          return (
            <div
              key={i}
              className={`landing-row${f.featured ? ' landing-row--featured' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                borderTop: '1px solid var(--border-subtle)',
                ...(i === FEATURES.length - 1 ? { borderBottom: '1px solid var(--border-subtle)' } : {}),
              }}
            >
              <div style={{
                width: 3,
                flexShrink: 0,
                background: f.featured ? 'var(--primary)' : 'transparent',
                marginRight: 20,
                borderRadius: 2,
              }} />

              <div className="landing-spec-row" style={{ flex: 1, padding: '26px 0', paddingRight: 16 }}>
                <div style={{ width: 220, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Icon size={13} color={f.featured ? 'var(--primary)' : 'var(--text-muted)'} />
                    <span style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.015em',
                      lineHeight: 1.3,
                    }}>
                      {f.label}
                    </span>
                  </div>
                </div>
                <p style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  lineHeight: 1.75,
                  margin: 0,
                  flex: 1,
                }}>
                  {f.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
