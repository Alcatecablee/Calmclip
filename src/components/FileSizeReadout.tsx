import { useState, useEffect } from 'react'

function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target === 0) { setValue(0); return }
    let frame: number
    const start = performance.now()
    function tick(now: number) {
      const t     = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.floor(eased * target))
      if (t < 1) frame = requestAnimationFrame(tick)
      else setValue(target)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}

function fmtBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i     = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const val   = bytes / Math.pow(1024, i)
  return `${i >= 2 ? val.toFixed(1) : Math.round(val)} ${units[i]}`
}

interface Props {
  size: number
}

export default function FileSizeReadout({ size }: Props) {
  const count = useCountUp(size)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontSize: 11,
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        color: 'var(--text-faint)',
        letterSpacing: '0.02em',
      }}>
        {fmtBytes(count)} loaded
      </span>
      <span style={{ color: 'var(--border)', fontSize: 11 }}>·</span>
      <span style={{
        fontSize: 11,
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        color: '#4ade80',
        letterSpacing: '0.02em',
      }}>
        0 B uploaded
      </span>
    </div>
  )
}
