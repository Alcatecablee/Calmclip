import { useState, useRef } from 'react'

interface Props {
  text: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export default function Tooltip({ text, children, position = 'top', delay = 350 }: Props) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<number | null>(null)

  const show = () => {
    timerRef.current = window.setTimeout(() => setVisible(true), delay)
  }
  const hide = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    setVisible(false)
  }

  const base: React.CSSProperties = {
    position:       'absolute',
    zIndex:         9999,
    background:     '#18181e',
    border:         '1px solid rgba(255, 255, 255, 0.10)',
    borderRadius:   6,
    padding:        '5px 9px',
    fontSize:       11,
    fontWeight:     500,
    color:          'rgba(255, 255, 255, 0.82)',
    whiteSpace:     'nowrap',
    pointerEvents:  'none',
    boxShadow:      '0 6px 20px rgba(0,0,0,0.45)',
    letterSpacing:  '0.01em',
    lineHeight:     1.4,
    transition:     'opacity 0.14s ease, transform 0.14s ease',
    opacity:         visible ? 1 : 0,
  }

  if (position === 'top') {
    base.bottom    = 'calc(100% + 7px)'
    base.left      = '50%'
    base.transform = `translateX(-50%) translateY(${visible ? 0 : 4}px)`
  } else if (position === 'bottom') {
    base.top       = 'calc(100% + 7px)'
    base.left      = '50%'
    base.transform = `translateX(-50%) translateY(${visible ? 0 : -4}px)`
  } else if (position === 'left') {
    base.right     = 'calc(100% + 7px)'
    base.top       = '50%'
    base.transform = `translateY(-50%) translateX(${visible ? 0 : 4}px)`
  } else {
    base.left      = 'calc(100% + 7px)'
    base.top       = '50%'
    base.transform = `translateY(-50%) translateX(${visible ? 0 : -4}px)`
  }

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {text && <div style={base}>{text}</div>}
    </div>
  )
}
