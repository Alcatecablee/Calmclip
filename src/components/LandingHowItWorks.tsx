import { FolderOpen, Sliders, Eye, Download } from 'lucide-react'

const STEPS = [
  {
    Icon: FolderOpen,
    label: 'Open your video',
    desc: 'Drop, browse, or paste any MP4, MOV, WebM or MKV file. Nothing leaves your device.',
  },
  {
    Icon: Sliders,
    label: 'Choose your edits',
    desc: 'Trim, cut silence, blur faces, resize. Use any combination.',
  },
  {
    Icon: Eye,
    label: 'Review in the preview',
    desc: 'See exactly what your export will look like before committing.',
  },
  {
    Icon: Download,
    label: 'Export to your device',
    desc: 'FFmpeg renders locally and saves the finished file straight to your machine.',
  },
]

export default function LandingHowItWorks() {
  return (
    <div style={{ width: '100%', maxWidth: 820, marginTop: 88 }}>
      <span className="landing-eyebrow">How it works</span>
      <h2 style={{
        fontSize: 28,
        fontWeight: 700,
        color: 'var(--text-primary)',
        letterSpacing: '-0.035em',
        textAlign: 'center',
        margin: '0 0 10px 0',
        lineHeight: 1.18,
      }}>
        From file to export in four steps
      </h2>
      <p style={{
        fontSize: 14,
        color: 'var(--text-dim)',
        textAlign: 'center',
        margin: '0 0 32px 0',
        lineHeight: 1.7,
        maxWidth: 480,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}>
        No account, no server, no waiting for uploads. Everything runs locally in your browser.
      </p>
      <div className="steps-grid">
        {STEPS.map((step, i) => {
          const Icon = step.Icon
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
                border: '1px solid var(--border)',
                borderRadius: 14,
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'var(--primary-a10)',
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "'SF Mono','Fira Code',monospace",
                  color: 'var(--primary)',
                  flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <Icon size={14} color="var(--primary)" />
              </div>
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
              }}>
                {step.label}
              </span>
              <span style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                lineHeight: 1.65,
              }}>
                {step.desc}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
