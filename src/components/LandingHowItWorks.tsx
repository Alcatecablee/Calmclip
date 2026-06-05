import { FolderOpen, Sliders, Eye, Download } from 'lucide-react'

const STEPS = [
  {
    Icon: FolderOpen,
    label: 'Open your video',
    desc: 'MP4, MOV, WebM, or MKV. Drag it onto the page or browse for it. That\'s the whole setup.',
  },
  {
    Icon: Sliders,
    label: 'Pick your tools',
    desc: 'Trim, silence cutter, face blur, audio, captions. Use whichever ones you need and skip the rest.',
  },
  {
    Icon: Eye,
    label: 'Check the preview',
    desc: 'Plays back with your edits applied so you know exactly what you\'re getting before you export.',
  },
  {
    Icon: Download,
    label: 'Export to your device',
    desc: 'Click export and the file downloads directly. No cloud processing, no waiting on a server.',
  },
]

export default function LandingHowItWorks() {
  return (
    <div style={{ width: '100%', maxWidth: 820, marginTop: 88 }}>
      <span className="landing-eyebrow">How it works</span>
      <h2 style={{
        fontSize: 30,
        fontWeight: 700,
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        color: 'var(--text-primary)',
        letterSpacing: '-0.035em',
        margin: '0 0 8px 0',
        lineHeight: 1.18,
      }}>
        From file to export in four steps
      </h2>
      <p style={{
        fontSize: 13,
        color: 'var(--text-dim)',
        marginTop: 0,
        marginBottom: 40,
        lineHeight: 1.75,
        maxWidth: 460,
      }}>
        Open a file and start editing. No sign-in, nothing to install.
      </p>

      <div style={{ width: '100%' }}>
        {STEPS.map((step, i) => {
          const Icon = step.Icon
          return (
            <div
              key={i}
              className="landing-row"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                borderTop: '1px solid var(--border-subtle)',
                ...(i === STEPS.length - 1 ? { borderBottom: '1px solid var(--border-subtle)' } : {}),
              }}
            >
              <div style={{
                width: 52,
                flexShrink: 0,
                paddingTop: 28,
                paddingBottom: 28,
              }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  color: 'var(--primary)',
                  letterSpacing: '0.1em',
                }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>

              <div style={{ flex: 1, padding: '26px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Icon size={13} color="var(--text-muted)" />
                  <span style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.015em',
                    lineHeight: 1.3,
                  }}>
                    {step.label}
                  </span>
                </div>
                <p style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  lineHeight: 1.75,
                  margin: 0,
                  maxWidth: 520,
                }}>
                  {step.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
