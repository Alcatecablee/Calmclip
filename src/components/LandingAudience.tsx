import { Video, Smartphone, BookOpen, Shield, Mic, Zap } from 'lucide-react'

const AUDIENCE = [
  {
    Icon: Shield,
    label: 'Journalists, legal and healthcare teams',
    desc: 'Source footage, depositions, and confidential recordings never reach a third-party server. HIPAA, attorney-client privilege, and source protection all require local processing. CalmClip delivers it.',
    featured: true,
  },
  {
    Icon: Video,
    label: 'YouTubers',
    desc: 'Trim, normalize audio, and batch export all ratios from one file.',
    featured: false,
  },
  {
    Icon: Smartphone,
    label: 'Short-form creators',
    desc: 'Resize to 9:16 for Reels, TikTok and Shorts. Batch export all ratios from a single source file.',
    featured: false,
  },
  {
    Icon: BookOpen,
    label: 'Educators and coaches',
    desc: 'Silence removal keeps lessons tight without manual editing. Nothing leaves your device.',
    featured: false,
  },
  {
    Icon: Mic,
    label: 'Podcasters',
    desc: 'Strip silence from video podcasts. Export clean audio and video together.',
    featured: false,
  },
  {
    Icon: Zap,
    label: 'Marketers',
    desc: 'Batch export 16:9, 9:16, 1:1 and 4:5 from a single source in one click. No re-uploading.',
    featured: false,
  },
]

export default function LandingAudience() {
  return (
    <div style={{ width: '100%', maxWidth: 820, marginTop: 88 }}>
      <span className="landing-eyebrow">Built for</span>
      <h2 style={{
        fontSize: 28,
        fontWeight: 700,
        color: 'var(--text-primary)',
        letterSpacing: '-0.035em',
        textAlign: 'center',
        margin: '0 0 10px 0',
        lineHeight: 1.18,
      }}>
        Who uses CalmClip
      </h2>
      <p style={{
        fontSize: 14,
        color: 'var(--text-dim)',
        textAlign: 'center',
        margin: '0 0 32px 0',
        marginLeft: 'auto',
        marginRight: 'auto',
        lineHeight: 1.7,
        maxWidth: 480,
      }}>
        Creators, educators, and professionals who cannot upload footage to third-party tools.
      </p>
      <div className="features-grid">
        {AUDIENCE.map((a, i) => {
          const Icon = a.Icon
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
                border: a.featured ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                borderRadius: 14,
                boxShadow: a.featured ? '0 2px 8px var(--primary-a10)' : '0 1px 4px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'var(--primary-a8)',
                border: '1px solid var(--primary-a14)',
                flexShrink: 0,
              }}>
                <Icon size={13} color="var(--primary)" />
              </div>
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
              }}>
                {a.label}
              </span>
              <span style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                lineHeight: 1.65,
              }}>
                {a.desc}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
