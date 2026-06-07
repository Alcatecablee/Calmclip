import { ShieldCheck, Cpu, Sparkles, Globe } from 'lucide-react'

const FEATURES = [
  {
    Icon: ShieldCheck,
    label: 'Zero-Upload Architecture',
    href: '/video-editor-no-upload',
    desc: 'Bypass your browser memory limits. Edit 4GB+ files instantly without ever uploading them to a server.',
    featured: true,
  },
  {
    Icon: Cpu,
    label: 'Hardware Acceleration',
    href: null,
    desc: 'CalmClip directly accesses your GPU via WebCodecs to render and export H.264 video at lightning speeds.',
    featured: false,
  },
  {
    Icon: Sparkles,
    label: '100% Local AI',
    href: null,
    desc: 'Auto-captions, silence removal, and face detection are powered by WASM models running securely on your machine.',
    featured: false,
  },
  {
    Icon: Globe,
    label: 'Browser-Native Ingestion',
    href: '/record-screen-online',
    desc: 'Install the extension to pull videos straight out of Google Drive and Dropbox, or record active tabs seamlessly.',
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
        Browser limits, shattered.
      </h2>
      <p style={{
        fontSize: 13,
        color: 'var(--text-dim)',
        marginTop: 0,
        marginBottom: 40,
        lineHeight: 1.75,
        maxWidth: 460,
      }}>
        A professional video editor that operates completely outside the cloud.
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
                    {f.href ? (
                      <a
                        href={f.href}
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          letterSpacing: '-0.015em',
                          lineHeight: 1.3,
                          textDecoration: 'none',
                        }}
                        onMouseOver={e => (e.currentTarget.style.color = 'var(--primary)')}
                        onMouseOut={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                      >
                        {f.label}
                      </a>
                    ) : (
                      <span style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.015em',
                        lineHeight: 1.3,
                      }}>
                        {f.label}
                      </span>
                    )}
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
