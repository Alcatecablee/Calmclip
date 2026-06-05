import { useEffect, useState } from 'react'
import type { BlurRegion } from './FaceBlurPanel'

interface BlurDraw {
  active: boolean
  startX: number
  startY: number
  endX:   number
  endY:   number
}

interface Props {
  blurRegions:       BlurRegion[]
  isDrawingBlur:     boolean
  onAddBlurRegion?:  (region: Omit<BlurRegion, 'id'>) => void
  onStopDrawingBlur?: () => void
  containerRef:      React.RefObject<HTMLDivElement | null>
}

export default function BlurRegionOverlay({
  blurRegions, isDrawingBlur, onAddBlurRegion, onStopDrawingBlur, containerRef,
}: Props) {
  const [blurDraw, setBlurDraw] = useState<BlurDraw>({
    active: false, startX: 0, startY: 0, endX: 0, endY: 0,
  })

  const handleBlurMouseDown = (e: React.MouseEvent) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top)  / rect.height
    setBlurDraw({ active: true, startX: x, startY: y, endX: x, endY: y })
  }

  useEffect(() => {
    if (!blurDraw.active) return
    const onMove = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top)  / rect.height))
      setBlurDraw(d => ({ ...d, endX: x, endY: y }))
    }
    const onUp = () => {
      if (onAddBlurRegion) {
        const xPct = Math.round(Math.min(blurDraw.startX, blurDraw.endX) * 100)
        const yPct = Math.round(Math.min(blurDraw.startY, blurDraw.endY) * 100)
        const wPct = Math.round(Math.abs(blurDraw.endX - blurDraw.startX) * 100)
        const hPct = Math.round(Math.abs(blurDraw.endY - blurDraw.startY) * 100)
        if (wPct > 2 && hPct > 2) {
          onAddBlurRegion({ x: xPct, y: yPct, w: wPct, h: hPct, note: 'Drawn region' })
        }
      }
      setBlurDraw({ active: false, startX: 0, startY: 0, endX: 0, endY: 0 })
      onStopDrawingBlur?.()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [
    blurDraw.active, blurDraw.startX, blurDraw.startY, blurDraw.endX, blurDraw.endY,
    onAddBlurRegion, onStopDrawingBlur, containerRef,
  ])

  return (
    <>
      {isDrawingBlur && (
        <div
          style={{ position: 'absolute', inset: 0, cursor: 'crosshair', zIndex: 20 }}
          onMouseDown={handleBlurMouseDown}
        >
          {blurDraw.active && (() => {
            const lx = Math.min(blurDraw.startX, blurDraw.endX) * 100
            const ly = Math.min(blurDraw.startY, blurDraw.endY) * 100
            const lw = Math.abs(blurDraw.endX - blurDraw.startX) * 100
            const lh = Math.abs(blurDraw.endY - blurDraw.startY) * 100
            return (
              <div
                style={{
                  position:     'absolute',
                  left:         `${lx}%`,
                  top:          `${ly}%`,
                  width:        `${lw}%`,
                  height:       `${lh}%`,
                  border:       '2px dashed var(--primary)',
                  background:   'var(--primary-a12)',
                  borderRadius: 4,
                  pointerEvents:'none',
                }}
              />
            )
          })()}
        </div>
      )}

      {blurRegions.map(r => (
        <div
          key={r.id}
          style={{
            position:      'absolute',
            left:          `${r.x}%`,
            top:           `${r.y}%`,
            width:         `${r.w}%`,
            height:        `${r.h}%`,
            background:    'rgba(124,58,237,0.15)',
            border:        '1.5px dashed rgba(167,139,250,0.5)',
            borderRadius:  4,
            pointerEvents: 'none',
            zIndex:        3,
          }}
        />
      ))}
    </>
  )
}
