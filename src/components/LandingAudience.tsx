import { Video, Smartphone, BookOpen, Shield, Mic, Zap } from 'lucide-react'

const AUDIENCE = [
  {
    Icon: Shield,
    label: 'Journalists, legal and healthcare teams',
    desc: 'Depositions, source footage, and witness interviews can\'t go to a third-party server. HIPAA, privilege, and source protection all require local processing. That\'s exactly what CalmClip handles.',
    featured: true,
  },
  {
    Icon: Video,
    label: 'YouTubers',
    desc: 'One source file, batch-exported to every ratio. Add captions and loudness normalization in the same pass.',
    featured: false,
  },
  {
    Icon: Smartphone,
    label: 'Short-form creators',
    desc: 'Shoot once and export to every format. Resize to 9:16 in seconds and get vertical, square, and landscape in one go.',
    featured: false,
  },
  {
    Icon: BookOpen,
    label: 'Educators and coaches',
    desc: 'Strips the dead air from recorded sessions automatically. Upload nothing.',
    featured: false,
  },
  {
    Icon: Mic,
    label: 'Podcasters',
    desc: 'Remove the gaps from recorded conversations and get clean audio and video in a single export.',
    featured: false,
  },
  {
    Icon: Zap,
    label: 'Marketers',
    desc: 'Get all four formats from one source file without re-uploading the same clip four times.',
    featured: false,
  },
]

export default function LandingAudience() {
  return (
    <div style={{ width: '100%', maxWidth: 820, marginTop: 88 }}>
      <span className="landing-eyebrow">Built for</span>
      <h2 style={{
        fontSize: 30,
        fontWeight: 700,
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        color: 'var(--text-primary)',
        letterSpacing: '-0.035em',
        margin: '0 0 8px 0',
        lineHeight: 1.18,
      }}>
        Who uses CalmClip
      </h2>
      <p style={{
        fontSize: 13,
        color: 'var(--text-dim)',
        marginTop: 0,
        marginBottom: 40,
        lineHeight: 1.75,
        maxWidth: 460,
      }}>
        Anyone whose footage can't leave their machine. Or anyone who's just tired of uploading to get anything done.
      </p>

      <div style={{ width: '100%' }}>
        {AUDIENCE.map((a, i) => {
          const Icon = a.Icon
          return (
            <div
              key={i}
              className={`landing-row${a.featured ? ' landing-row--featured' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                borderTop: '1px solid var(--border-subtle)',
                ...(i === AUDIENCE.length - 1 ? { borderBottom: '1px solid var(--border-subtle)' } : {}),
              }}
            >
              <div style={{
                width: 3,
                flexShrink: 0,
                background: a.featured ? 'var(--primary)' : 'transparent',
                marginRight: 20,
                borderRadius: 2,
              }} />

              <div className="landing-spec-row" style={{ flex: 1, padding: '24px 0', paddingRight: 16 }}>
                <div style={{ width: 220, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Icon size={13} color={a.featured ? 'var(--primary)' : 'var(--text-muted)'} />
                    <span style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.4,
                    }}>
                      {a.label}
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
                  {a.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
