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

      // Scale the canvas backing store by devicePixelRatio for crisp rendering
      // on HiDPI/retina displays. Drawing is done in CSS pixel coordinates via
      // setTransform so callers never need to account for DPR manually.
      const dpr  = window.devicePixelRatio || 1
      const cssW = canvas.offsetWidth
      const cssH = canvas.offsetHeight
      const pxW  = Math.round(cssW * dpr)
      const pxH  = Math.round(cssH * dpr)

      if (cssW > 0 && cssH > 0 && (canvas.width !== pxW || canvas.height !== pxH)) {
        canvas.width  = pxW
        canvas.height = pxH
      }

      // Reset and apply the DPR scale each frame so clearRect covers the full
      // canvas in CSS pixel space regardless of accumulated transforms.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssW, cssH)

      if (captionGroups.length === 0 || cssW === 0) {
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

        // Scale style values from their 1080p baseline to the preview CSS height
        const scaleFactor = Math.max(0.25, cssH / 1080)
        const scaledStyle = {
          ...captionStyle,
          fontSize:    Math.round(captionStyle.fontSize    * scaleFactor),
          // Guard: only apply Math.max(1,...) when the original strokeWidth is
          // non-zero. Styles with strokeWidth=0 must stay at 0 so the stroke
          // pass in drawCaptions is skipped. Without this guard every zero-stroke
          // preset (e.g. Boxed) draws an unwanted 1px outline in the preview.
          strokeWidth: captionStyle.strokeWidth > 0
            ? Math.max(1, Math.round(captionStyle.strokeWidth * scaleFactor))
            : 0,
          shadowBlur:  Math.round(captionStyle.shadowBlur  * scaleFactor),
          bgRadius:    Math.round(captionStyle.bgRadius     * scaleFactor),
        }

        drawCaptions(ctx, cssW, cssH, active, scaledStyle, animProgress)
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
