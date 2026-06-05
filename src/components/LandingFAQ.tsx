import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FAQ_ITEMS = [
  {
    q: 'Does CalmClip upload my video to a server?',
    a: 'No. CalmClip processes everything inside your browser using WebAssembly. Zero bytes of your video are ever sent to any server. Your files stay on your device at all times.',
  },
  {
    q: 'Is CalmClip free to use?',
    a: 'Yes. CalmClip is completely free. No account, no subscription, no hidden fees. Open the site and start editing immediately.',
  },
  {
    q: 'What video formats does CalmClip support?',
    a: 'CalmClip supports MP4, MOV, WebM, and MKV files. All editing and export happen locally in your browser using FFmpeg compiled to WebAssembly.',
  },
  {
    q: 'Can CalmClip handle large video files?',
    a: 'Yes. CalmClip processes files locally using FFmpeg compiled to WebAssembly, so it handles large files (1 GB and above) without upload delays. Editing starts immediately after you open the file.',
  },
  {
    q: 'Does CalmClip require an account or login?',
    a: 'No. CalmClip requires no account, no login, and no registration. Open the site, drop your video, and start editing.',
  },
]

export default function LandingFAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div style={{ width: '100%', maxWidth: 820, marginTop: 88, marginBottom: 12 }}>
      <span className="landing-eyebrow">FAQ</span>
      <h2 style={{
        fontSize: 28,
        fontWeight: 700,
        color: 'var(--text-primary)',
        letterSpacing: '-0.035em',
        textAlign: 'center',
        margin: '0 0 10px 0',
        lineHeight: 1.18,
      }}>
        Common questions
      </h2>
      <p style={{
        fontSize: 14,
        color: 'var(--text-dim)',
        textAlign: 'center',
        margin: '0 0 32px 0',
        lineHeight: 1.7,
      }}>
        Everything you need to know before you start.
      </p>
      <div>
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = open === i
          return (
            <div
              key={i}
              style={{
                borderTop: i === 0 ? '1px solid var(--border-subtle)' : 'none',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '15px 0',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  lineHeight: 1.4,
                }}>
                  {item.q}
                </span>
                <ChevronDown
                  size={15}
                  color="var(--text-dim)"
                  style={{
                    flexShrink: 0,
                    transition: 'transform 0.18s ease',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>
              <div style={{
                display: 'grid',
                gridTemplateRows: isOpen ? '1fr' : '0fr',
                transition: 'grid-template-rows 0.2s ease',
              }}>
                <div style={{ overflow: 'hidden' }}>
                  <p style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    lineHeight: 1.7,
                    margin: '0 0 15px 0',
                    paddingRight: 28,
                  }}>
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
