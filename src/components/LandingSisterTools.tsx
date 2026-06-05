import { ArrowUpRight } from 'lucide-react'

export default function LandingSisterTools() {
  return (
    <div style={{ width: '100%', maxWidth: 820, marginTop: 88 }}>
      <span className="landing-eyebrow">From the same maker</span>
      <h2 style={{
        fontSize:      28,
        fontWeight:    700,
        color:         'var(--text-primary)',
        letterSpacing: '-0.035em',
        textAlign:     'center',
        margin:        '0 0 10px 0',
        lineHeight:    1.18,
      }}>
        More browser-native tools that respect your privacy
      </h2>
      <p style={{
        fontSize:   14,
        color:      'var(--text-dim)',
        textAlign:  'center',
        margin:     '0 auto 32px auto',
        lineHeight: 1.7,
        maxWidth:   480,
      }}>
        Same principle as CalmClip: everything runs locally. No upload, no account, no tracking.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

        <a
          href="https://quickbridge.app?ref=calmclip"
          target="_blank"
          rel="noopener noreferrer"
          className="sister-tool-card"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="sister-tool-logo-area sister-tool-logo-area--qb">
            <img
              src="/quickbridge-logo.png"
              alt="QuickBridge"
              style={{ width: 72, height: 'auto', display: 'block', mixBlendMode: 'multiply' }}
            />
          </div>
          <div className="sister-tool-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>QuickBridge</span>
              <ArrowUpRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, display: 'block', marginBottom: 6 }}>
              P2P file transfer between any devices. No install, no account.
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>quickbridge.app</span>
          </div>
        </a>

        <a
          href="https://calmpc.com?ref=calmclip"
          target="_blank"
          rel="noopener noreferrer"
          className="sister-tool-card"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="sister-tool-logo-area sister-tool-logo-area--cpc">
            <img
              src="/calmpc-logo.png"
              alt="CalmPC"
              style={{ width: 64, height: 'auto', display: 'block', mixBlendMode: 'screen' }}
            />
          </div>
          <div className="sister-tool-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>CalmPC</span>
              <ArrowUpRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, display: 'block', marginBottom: 6 }}>
              Free PC health check and fix guides. Runs in your browser.
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>calmpc.com</span>
          </div>
        </a>

      </div>
    </div>
  )
}
