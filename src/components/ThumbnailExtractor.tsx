import { useRef, useState } from 'react'
import { Camera, Check } from 'lucide-react'
import { fmtTimePrecise } from '../lib/format'

interface Props {
  videoRef:  React.RefObject<HTMLVideoElement | null>
  trimStart: number
  trimEnd:   number
}

export default function ThumbnailExtractor({ videoRef, trimStart, trimEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trimDur   = Math.max(0, trimEnd - trimStart)

  const [offset,   setOffset]   = useState(0)
  const [captured, setCaptured] = useState(false)

  function handleSeek(rel: number) {
    setOffset(rel)
    setCaptured(false)
    if (videoRef.current) {
      videoRef.current.currentTime = trimStart + rel
    }
  }

  function capture() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width  = video.videoWidth  || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href    = url
      const ts  = fmtTimePrecise(trimStart + offset).replace(':', 'm').replace('.', 's')
      a.download = `thumbnail_${ts}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      setCaptured(true)
      setTimeout(() => setCaptured(false), 2500)
    }, 'image/png')
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Frame position</span>
          <span className="text-xs" style={{ color: 'var(--primary)' }}>
            {fmtTimePrecise(trimStart + offset)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={trimDur || 1}
          step={0.04}
          value={offset}
          onChange={e => handleSeek(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--primary)' }}
        />
      </div>

      <button
        onClick={capture}
        className="flex items-center justify-center gap-2 text-xs py-2 transition-colors"
        style={{
          background:   captured ? 'rgba(16,185,129,0.12)' : 'var(--bg-surface-2)',
          border:       `1px solid ${captured ? '#10b981' : 'var(--border)'}`,
          color:        captured ? '#10b981' : 'var(--text-primary)',
          borderRadius: 6,
          cursor:       'pointer',
        }}
      >
        {captured ? <Check size={13} /> : <Camera size={13} />}
        {captured ? 'Saved as PNG' : 'Capture frame as PNG'}
      </button>

      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
        Drag the slider to seek, then capture. Downloads as a full-resolution PNG.
      </p>
    </div>
  )
}
