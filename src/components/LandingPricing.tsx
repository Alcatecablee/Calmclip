import { Check, Sparkles } from 'lucide-react'

const FREE_FEATURES = [
  'Trim and cut with dual-handle slider',
  'Resize to any ratio (fit or fill)',
  'Silence removal',
  'Loudness normalization',
  'Metadata stripping',
  '720p WebM export (max 1280x720)',
  'Screen recording',
  'No signup required',
]

const PRO_FEATURES = [
  'Everything in Free',
  '1080p WebM export (up to 1920x1080) + MOV format',
  'Batch export (all 4 ratios at once)',
  'Face blur (on-device, no upload)',
  'Watermark overlay',
  'Export presets',
  'AI speech transcription (Whisper, on-device)',
  'Hook scorer, pace analyzer, filler word removal',
  'B-roll gap detector and chapter generator',
]

const MODAL_SHADOW = '0 24px 48px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.10)'

interface Props {
  onUpgrade: () => void
}

export default function LandingPricing({ onUpgrade }: Props) {
  return (
    <div style={{ width: '100%', maxWidth: 820, marginTop: 88 }}>
      <span className="landing-eyebrow">Pricing</span>
      <h2 style={{
        fontSize: 30,
        fontWeight: 700,
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        color: 'var(--text-primary)',
        letterSpacing: '-0.035em',
        margin: '0 0 8px 0',
        lineHeight: 1.18,
      }}>
        Free to start. Upgrade when you need more.
      </h2>
      <p style={{
        fontSize: 13,
        color: 'var(--text-dim)',
        marginTop: 0,
        marginBottom: 40,
        lineHeight: 1.75,
        maxWidth: 460,
      }}>
        No account needed. No trial period. Upgrade only if you want to.
      </p>

      <div className="pricing-grid">
        <div style={{
          padding: '28px 24px 32px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <p style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            margin: '0 0 6px 0',
          }}>
            Free
          </p>
          <p style={{
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            margin: '0 0 4px 0',
            lineHeight: 1,
          }}>
            $0
          </p>
          <p style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            margin: '0 0 20px 0',
          }}>
            Everything you need to get started.
          </p>
          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 16 }} />
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {FREE_FEATURES.map((feat, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Check size={12} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        <div style={{
          padding: '28px 24px 32px',
          background: 'var(--bg-surface)',
          border: '1.5px solid var(--primary)',
          borderRadius: 16,
          boxShadow: MODAL_SHADOW,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            top: -12,
            left: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--primary)',
            borderRadius: 21,
            padding: '3px 10px 3px 8px',
          }}>
            <Sparkles size={9} color="var(--primary-foreground)" />
            <span style={{ fontSize: 10, color: 'var(--primary-foreground)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Pro
            </span>
          </div>

          <p style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--primary)',
            margin: '0 0 6px 0',
          }}>
            Pro
          </p>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '0 0 4px 0' }}>
            <p style={{
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em',
              margin: 0,
              lineHeight: 1,
            }}>
              $39
            </p>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 400 }}>one-time</span>
          </div>

          <p style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            margin: '0 0 4px 0',
          }}>
            Pay once, use forever.
          </p>
          <p style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            margin: '0 0 16px 0',
            lineHeight: 1.5,
          }}>
            Less than two months of any subscription editor. No recurring cost.
          </p>
          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 16 }} />
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: 9 }}>
            {PRO_FEATURES.map((feat, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Check size={12} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{feat}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={onUpgrade}
            className="navbar-upgrade-btn"
            style={{ width: '100%', fontSize: 13, height: 36, marginLeft: 0 }}
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  )
}
