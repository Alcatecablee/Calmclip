import { useRef, useState } from 'react'
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'
import Tooltip from './Tooltip'

interface ToggleProps {
  checked:  boolean
  onToggle: (e: React.MouseEvent) => void
  label:    string
}

export function HeaderToggle({ checked, onToggle, label }: ToggleProps) {
  return (
    <button
      onClick={onToggle}
      title={label}
      style={{
        background: 'none',
        border:     'none',
        padding:    '0 2px',
        cursor:     'pointer',
        display:    'flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <div style={{
        width:        30,
        height:       16,
        borderRadius: 8,
        background:   checked ? 'var(--primary)' : 'var(--border)',
        position:     'relative',
        transition:   'background 0.2s ease',
        flexShrink:   0,
      }}>
        <div style={{
          position:     'absolute',
          top:          2,
          left:         checked ? 16 : 2,
          width:        12,
          height:       12,
          borderRadius: '50%',
          background:   '#ffffff',
          boxShadow:    '0 1px 3px rgba(0,0,0,0.20)',
          transition:   'left 0.15s ease',
        }} />
      </div>
    </button>
  )
}

interface Props {
  icon:          React.ReactNode
  label:         string
  children:      React.ReactNode
  collapsible?:  boolean
  defaultOpen?:  boolean
  tooltip?:      string
  isOpen?:       boolean
  onToggle?:     () => void
  badge?:        string
  headerAction?: React.ReactNode
}

const ANIM_MS = 220

function findScroller(el: HTMLElement | null): Element {
  let cur = el?.parentElement ?? null
  while (cur && cur !== document.documentElement) {
    const s = window.getComputedStyle(cur)
    if (s.overflowY === 'auto' || s.overflowY === 'scroll') return cur
    cur = cur.parentElement
  }
  return document.scrollingElement ?? document.documentElement
}

export default function Section({
  icon, label, children, collapsible, defaultOpen = true,
  tooltip, isOpen, onToggle, badge, headerAction,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const controlled = isOpen !== undefined && onToggle !== undefined
  const open       = controlled ? isOpen : internalOpen
  const canToggle  = controlled || collapsible
  const headerRef  = useRef<HTMLDivElement>(null)

  function handleClick() {
    const header    = headerRef.current
    const topBefore = header ? header.getBoundingClientRect().top : 0
    const scroller  = findScroller(header)

    if (controlled) onToggle!()
    else if (collapsible) setInternalOpen(o => !o)
    else return

    if (!header) return

    setTimeout(() => {
      const diff = header.getBoundingClientRect().top - topBefore
      if (Math.abs(diff) > 1) scroller.scrollTop += diff
    }, ANIM_MS + 10)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5 w-full group" style={{ minHeight: 20 }}>
        <div
          ref={headerRef}
          role={canToggle ? 'button' : undefined}
          tabIndex={canToggle ? 0 : undefined}
          onClick={handleClick}
          onKeyDown={e => { if (canToggle && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleClick() } }}
          className="flex items-center gap-2.5 flex-1 py-1 text-left"
          style={{ cursor: canToggle ? 'pointer' : 'default', minWidth: 0 }}
        >
          <span
            className="transition-colors duration-200 flex items-center justify-center flex-shrink-0 group-hover:text-primary"
            style={{ color: 'var(--text-faint)' }}
          >
            {icon}
          </span>
          <span
            className="flex-1 font-semibold uppercase transition-colors duration-200 group-hover:text-primary"
            style={{ fontSize: 10, letterSpacing: '0.07em', color: 'var(--text-muted)' }}
          >
            {label}
          </span>
          {badge && !open && (
            <span style={{
              fontSize:     9,
              fontFamily:   "'SF Mono','Fira Code',monospace",
              color:        'var(--text-faint)',
              background:   'var(--border-subtle)',
              border:       '1px solid var(--border-subtle)',
              padding:      '1px 5px',
              borderRadius: 10,
              flexShrink:   0,
              maxWidth:     96,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {badge}
            </span>
          )}
          {tooltip && (
            <Tooltip text={tooltip} position="left">
              <span
                className="transition-colors duration-200 flex items-center"
                style={{ color: 'var(--text-faint)' }}
              >
                <HelpCircle size={11} />
              </span>
            </Tooltip>
          )}
          {canToggle && (
            <span
              className="transition-colors duration-200 flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </span>
          )}
        </div>
        {headerAction && (
          <div style={{ flexShrink: 0 }}>
            {headerAction}
          </div>
        )}
      </div>

      <div
        style={{
          display:          'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition:       `grid-template-rows ${ANIM_MS}ms ease`,
        }}
      >
        <div className="pl-6" style={{ overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
