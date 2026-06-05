import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FAQ_ITEMS = [
  {
    q: 'Does CalmClip upload my video to a server?',
    a: 'No. Everything runs in your browser through WebAssembly. Your video never leaves your device, not even a single frame.',
  },
  {
    q: 'Is CalmClip free to use?',
    a: "Yes, it's free. No account, no subscription, no gotcha fees. Just open the site and start.",
  },
  {
    q: 'What video formats does CalmClip support?',
    a: 'MP4, MOV, WebM, and MKV. Everything runs locally, so there is no upload step regardless of which format you use.',
  },
  {
    q: 'Can CalmClip handle large video files?',
    a: 'Yes. Since nothing is uploaded, file size never causes upload delays. Open the file and editing starts immediately. Most machines handle files over 1 GB without trouble.',
  },
  {
    q: 'Does CalmClip require an account or login?',
    a: 'No. Drop your file and start editing. There is no account, no registration, nothing to set up first.',
  },
]

export default function LandingFAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div style={{ width: '100%', maxWidth: 820, marginTop: 88, marginBottom: 12 }}>
      <span className="landing-eyebrow">FAQ</span>
      <h2 style={{
        fontSize: 30,
        fontWeight: 700,
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        color: 'var(--text-primary)',
        letterSpacing: '-0.035em',
        margin: '0 0 8px 0',
        lineHeight: 1.18,
      }}>
        Common questions
      </h2>
      <p style={{
        fontSize: 13,
        color: 'var(--text-dim)',
        marginTop: 0,
        marginBottom: 40,
        lineHeight: 1.75,
      }}>
        If something is not covered here, the answer is almost certainly no uploads and no account.
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
                  padding: '16px 0',
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
                    lineHeight: 1.75,
                    margin: '0 0 16px 0',
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
