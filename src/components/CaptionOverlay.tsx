import { useEffect, useRef } from 'react'
import { getActiveCaption, drawCaptions } from '../lib/captionEngine'
import type { CaptionGroup, CaptionStyle } from '../lib/captionEngine'

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  captionGroups: CaptionGroup[]
  captionStyle: CaptionStyle
}

export default function CaptionOverlay({ videoRef, captionGroups, captionStyle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let frameId: number

    const render = () => {
      const v = videoRef.current
      const ctx = canvas.getContext('2d')
      if (!v || !ctx) { frameId = requestAnimationFrame(render); return }

      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w
        canvas.height = h
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (captionGroups.length === 0 || canvas.width === 0) {
        frameId = requestAnimationFrame(render)
        return
      }

      const t = v.currentTime
      const active = getActiveCaption(captionGroups, t)
      if (active) {
        const word = active.group.words[active.activeWordIndex]
        const wordDur = word ? Math.max(0.05, word.endTime - word.startTime) : 0.5
        const wordStart = word?.startTime ?? 0
        const animProgress = Math.min(1, (t - wordStart) / wordDur)

        const scaleFactor = Math.max(0.25, canvas.height / 1080)
        const scaledStyle = {
          ...captionStyle,
          fontSize: Math.round(captionStyle.fontSize * scaleFactor),
          strokeWidth: Math.max(1, Math.round(captionStyle.strokeWidth * scaleFactor)),
          shadowBlur: Math.round(captionStyle.shadowBlur * scaleFactor),
          bgRadius: Math.round(captionStyle.bgRadius * scaleFactor),
        }

        drawCaptions(ctx, canvas.width, canvas.height, active, scaledStyle, animProgress)
      }

      frameId = requestAnimationFrame(render)
    }

    frameId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frameId)
  }, [videoRef, captionGroups, captionStyle])

  if (captionGroups.length === 0) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'absolute',
        inset:         0,
        width:         '100%',
        height:        '100%',
        pointerEvents: 'none',
        zIndex:        10,
      }}
    />
  )
}
