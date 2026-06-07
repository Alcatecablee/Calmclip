import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Check, Sparkles } from 'lucide-react'
import type { FeaturePageConfig } from '../lib/featurePages'

const SLUG_CATEGORY: Record<string, string> = {
  'trim-video-online':             'Editing',
  'remove-silence-from-video':     'Editing',
  'remove-filler-words':           'Editing',
  'batch-export-video':            'Editing',
  'video-editor-no-upload':        'Editing',
  'normalize-video-audio':         'Audio',
  'denoise-audio-online':          'Audio',
  'add-captions-to-video':         'AI tools',
  'ai-video-transcription':        'AI tools',
  'generate-video-chapters':       'AI tools',
  'face-blur-video':               'Privacy',
  'remove-video-metadata':         'Privacy',
  'resize-video-online':           'Formats',
  'crop-video-for-tiktok':         'Formats',
  'crop-video-for-instagram':      'Formats',
  'crop-video-for-youtube-shorts': 'Formats',
  'record-screen-online':          'Create',
  'add-watermark-to-video':        'Create',
  'extract-video-thumbnail':       'Create',
  'video-editor-for-lawyers':      'Professional',
  'video-editor-for-journalists':  'Professional',
}

function Breadcrumb({ slug, shortLabel }: { slug: string; shortLabel: string }) {
  const category = SLUG_CATEGORY[slug] ?? 'Tools'

  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'CalmClip', item: 'https://calmclip.video/' },
        { '@type': 'ListItem', position: 2, name: category },
        { '@type': 'ListItem', position: 3, name: shortLabel, item: `https://calmclip.video/${slug}` },
      ],
    }
    const el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = 'breadcrumb-schema'
    el.textContent = JSON.stringify(schema)
    document.head.appendChild(el)
    return () => { document.getElementById('breadcrumb-schema')?.remove() }
  }, [slug, shortLabel, category])

  return (
    <nav aria-label="Breadcrumb" style={{ width: '100%', maxWidth: 820, marginBottom: 24 }}>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 0' }}>
        <li style={{ display: 'flex', alignItems: 'center' }}>
          <a
            href="/"
            style={{ fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none' }}
            onMouseOver={e => (e.currentTarget.style.color = 'var(--primary)')}
            onMouseOut={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          >
            CalmClip
          </a>
          <ChevronRight size={11} color="var(--text-dim)" style={{ margin: '0 4px', flexShrink: 0 }} />
        </li>
        <li style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {category}
          </span>
          <ChevronRight size={11} color="var(--text-dim)" style={{ margin: '0 4px', flexShrink: 0 }} />
        </li>
        <li>
          <span
            style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}
            aria-current="page"
          >
            {shortLabel}
          </span>
        </li>
      </ol>
    </nav>
  )
}

interface Props {
  config:       FeaturePageConfig
  allPages:     FeaturePageConfig[]
  onOpenVideo:  () => void
  onUpgrade:    () => void
}

function FaqRow({ item, isOpen, onToggle }: { item: { q: string; a: string }; isOpen: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <button
        onClick={onToggle}
        style={{
          width:           '100%',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          gap:             12,
          padding:         '16px 0',
          background:      'transparent',
          border:          'none',
          cursor:          'pointer',
          textAlign:       'left',
        }}
        aria-expanded={isOpen}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          {item.q}
        </span>
        <ChevronDown
          size={15}
          color="var(--text-dim)"
          style={{ flexShrink: 0, transition: 'transform 0.18s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.2s ease' }}>
        <div style={{ overflow: 'hidden' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.75, margin: '0 0 16px 0', paddingRight: 28 }}>
            {item.a}
          </p>
        </div>
      </div>
    </div>
  )
}

function SectionEyebrow({ label }: { label: string }) {
  return <span className="landing-eyebrow">{label}</span>
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 style={{
      fontSize:      30,
      fontWeight:    700,
      fontFamily:    "'Space Grotesk', system-ui, sans-serif",
      color:         'var(--text-primary)',
      letterSpacing: '-0.035em',
      margin:        '0 0 8px 0',
      lineHeight:    1.18,
    }}>
      {children}
    </h2>
  )
}

function SectionSubtext({ children }: { children: string }) {
  return (
    <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 0, marginBottom: 40, lineHeight: 1.75, maxWidth: 480 }}>
      {children}
    </p>
  )
}

function RowList({ items }: { items: Array<{ label: string; desc: string; featured?: boolean }> }) {
  return (
    <div style={{ width: '100%' }}>
      {items.map((item, i) => (
        <div
          key={i}
          className={`landing-row${item.featured ? ' landing-row--featured' : ''}`}
          style={{
            display:    'flex',
            alignItems: 'stretch',
            borderTop:  '1px solid var(--border-subtle)',
            ...(i === items.length - 1 ? { borderBottom: '1px solid var(--border-subtle)' } : {}),
          }}
        >
          <div style={{
            width:        3,
            flexShrink:   0,
            background:   item.featured ? 'var(--primary)' : 'transparent',
            marginRight:  20,
            borderRadius: 2,
          }} />
          <div className="landing-spec-row" style={{ flex: 1, padding: '24px 0', paddingRight: 16 }}>
            <div style={{ width: 220, flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.4 }}>
                {item.label}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.75, margin: 0, flex: 1 }}>
              {item.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function StepList({ steps }: { steps: Array<{ label: string; desc: string }> }) {
  return (
    <div style={{ width: '100%' }}>
      {steps.map((step, i) => (
        <div
          key={i}
          className="landing-row"
          style={{
            display:    'flex',
            alignItems: 'flex-start',
            borderTop:  '1px solid var(--border-subtle)',
            ...(i === steps.length - 1 ? { borderBottom: '1px solid var(--border-subtle)' } : {}),
          }}
        >
          <div style={{ width: 52, flexShrink: 0, paddingTop: 28, paddingBottom: 28 }}>
            <span style={{
              fontSize:      11,
              fontWeight:    700,
              fontFamily:    "'Space Grotesk', system-ui, sans-serif",
              color:         'var(--primary)',
              letterSpacing: '0.1em',
            }}>
              {String(i + 1).padStart(2, '0')}
            </span>
          </div>
          <div style={{ flex: 1, padding: '26px 0' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', lineHeight: 1.3, margin: '0 0 8px 0' }}>
              {step.label}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.75, margin: 0, maxWidth: 520 }}>
              {step.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function FeatureLandingPage({ config, allPages, onOpenVideo, onUpgrade }: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const relatedPages = allPages.filter(p => config.relatedSlugs.includes(p.slug))
  const otherPages   = allPages.filter(p => p.slug !== config.slug)

  return (
    <div
      className="flex-1 flex flex-col items-center justify-start overflow-y-auto"
      style={{ padding: '44px 24px 80px', background: 'var(--bg-page)' }}
    >

      <Breadcrumb slug={config.slug} shortLabel={config.shortLabel} />

      {/* Hero */}
      <div style={{ width: '100%', maxWidth: 820 }}>
        {config.isPro && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--primary-a10)', border: '1px solid var(--primary-a20)', borderRadius: 21, padding: '3px 10px 3px 8px', marginBottom: 20 }}>
            <Sparkles size={9} color="var(--primary)" />
            <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Pro feature
            </span>
          </div>
        )}

        <h1 style={{
          fontSize:      'clamp(36px, 5.5vw, 64px)',
          fontWeight:    700,
          fontFamily:    "'Space Grotesk', system-ui, sans-serif",
          lineHeight:    1.06,
          letterSpacing: '-0.038em',
          color:         'var(--text-primary)',
          maxWidth:      820,
          margin:        '0 0 20px 0',
        }}>
          {config.headline}
        </h1>

        <p style={{ fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 560, margin: '0 0 28px 0', fontWeight: 400 }}>
          {config.subheadline}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 32 }}>
          {(['Zero uploads', 'No account', 'No install'] as const).map(label => (
            <span key={label} style={{
              fontSize:     11,
              fontWeight:   500,
              color:        'var(--text-muted)',
              background:   'var(--bg-surface)',
              border:       '1px solid var(--border)',
              borderRadius: 21,
              padding:      '4px 11px',
              whiteSpace:   'nowrap',
            }}>
              {label}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={config.isPro ? onUpgrade : onOpenVideo}
            className="navbar-upgrade-btn"
            style={{ height: 42, fontSize: 14, padding: '0 28px' }}
          >
            {config.isPro ? 'Get Pro and ' : 'Open video to '}{config.ctaLabel}
          </button>
          {config.isPro && (
            <button
              onClick={onOpenVideo}
              style={{
                height:       42,
                fontSize:     13,
                padding:      '0 20px',
                background:   'var(--bg-surface)',
                border:       '1px solid var(--border)',
                borderRadius: 8,
                color:        'var(--text-muted)',
                cursor:       'pointer',
              }}
            >
              Try free features
            </button>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="section-reveal" style={{ width: '100%', maxWidth: 820, marginTop: 80 }}>
        <SectionEyebrow label="How it works" />
        <SectionHeading>{config.stepsHeadline}</SectionHeading>
        <SectionSubtext>{`No account, no install, no upload. Just open a file and ${config.ctaLabel}.`}</SectionSubtext>
        <StepList steps={config.steps} />
      </div>

      {/* Benefits */}
      <div className="section-reveal" style={{ width: '100%', maxWidth: 820, marginTop: 80 }}>
        <SectionEyebrow label="Why CalmClip" />
        <SectionHeading>{config.benefitsHeadline}</SectionHeading>
        <SectionSubtext>Not one frame of your video touches a server. Everything runs in your browser, on your machine.</SectionSubtext>
        <RowList items={config.benefits} />
      </div>

      {/* Use cases */}
      <div className="section-reveal" style={{ width: '100%', maxWidth: 820, marginTop: 80 }}>
        <SectionEyebrow label="Built for" />
        <SectionHeading>{config.useCasesHeadline}</SectionHeading>
        <SectionSubtext>Built for anyone whose footage cannot leave their machine, and anyone fed up with upload spinners.</SectionSubtext>
        <RowList items={config.useCases} />
      </div>

      {/* FAQ */}
      <div className="section-reveal" style={{ width: '100%', maxWidth: 820, marginTop: 80 }}>
        <SectionEyebrow label="FAQ" />
        <SectionHeading>Common questions</SectionHeading>
        <SectionSubtext>{`If you have questions about ${config.shortLabel.toLowerCase()}, these are the ones we hear most.`}</SectionSubtext>
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {config.faq.map((item, i) => (
            <FaqRow
              key={i}
              item={item}
              isOpen={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? null : i)}
            />
          ))}
        </div>
      </div>

      {/* Related tools */}
      <div className="section-reveal" style={{ width: '100%', maxWidth: 820, marginTop: 80 }}>
        <SectionEyebrow label="Related tools" />
        <SectionHeading>More from CalmClip</SectionHeading>
        <SectionSubtext>Every tool runs locally. No file leaves your device for any of them.</SectionSubtext>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {relatedPages.map(page => (
            <a
              key={page.slug}
              href={`/${page.slug}`}
              className="landing-card-hover"
              style={{
                display:       'flex',
                flexDirection: 'column',
                gap:           6,
                padding:       '18px 20px',
                background:    'var(--bg-surface)',
                border:        '1px solid var(--border)',
                borderRadius:  14,
                textDecoration:'none',
                color:         'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  {page.shortLabel}
                </span>
                {page.isPro && (
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--primary)', background: 'var(--primary-a10)', borderRadius: 8, padding: '2px 6px' }}>
                    Pro
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {page.metaDesc.split('.')[0]}.
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', marginTop: 4 }}>
                Try it free
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div
        className="section-reveal"
        style={{
          width:           '100%',
          maxWidth:        820,
          marginTop:       80,
          paddingTop:      40,
          borderTop:       '1px solid var(--border)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          gap:             24,
          flexWrap:        'wrap',
        }}
      >
        <div>
          <p style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Grotesk', system-ui, sans-serif", color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: '0 0 6px 0', lineHeight: 1.25 }}>
            Ready to {config.ctaLabel}?
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0, lineHeight: 1.7 }}>
            Free, no account, nothing to install. Drop your file and start.
          </p>
        </div>
        <button
          onClick={config.isPro ? onUpgrade : onOpenVideo}
          className="navbar-upgrade-btn"
          style={{ height: 40, fontSize: 14, padding: '0 32px', flexShrink: 0 }}
        >
          {config.isPro ? 'Upgrade to Pro' : 'Start editing now'}
        </button>
      </div>

      {/* All tools nav */}
      <nav
        aria-label="All CalmClip tools"
        style={{ width: '100%', maxWidth: 820, marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border-subtle)' }}
      >
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.56px', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
          All free browser tools
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
          {otherPages.map(page => (
            <a
              key={page.slug}
              href={`/${page.slug}`}
              style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}
              onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              {page.shortLabel}
            </a>
          ))}
          <a
            href="/"
            style={{ fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none' }}
            onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            Video editor (home)
          </a>
        </div>
      </nav>

      {/* Free feature check list */}
      <div style={{ width: '100%', maxWidth: 820, marginTop: 32 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
          {[
            'Trim and cut video',
            'Resize to any ratio',
            'Remove silence',
            'Normalize audio',
            'Denoise audio',
            'Strip metadata',
            'Screen recording',
            'Thumbnail extraction',
          ].map(item => (
            <span key={item} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-faint)' }}>
              <Check size={10} color="#10b981" />
              {item}
            </span>
          ))}
        </div>
      </div>

      <a
        href="/privacy.html"
        style={{ marginTop: 24, fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none' }}
        onMouseOver={e => (e.currentTarget.style.color = 'var(--primary)')}
        onMouseOut={e => (e.currentTarget.style.color = 'var(--text-dim)')}
      >
        Privacy policy
      </a>
    </div>
  )
}
