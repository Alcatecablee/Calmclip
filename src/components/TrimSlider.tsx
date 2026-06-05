import type React from 'react'
import { useState, useEffect, useRef } from 'react'

interface SegmentMark {
  start: number
  end:   number
}

interface Props {
  duration:      number
  start:         number
  end:           number
  onChange:      (start: number, end: number) => void
  silenceMarks?: SegmentMark[]
  manualMarks?:  SegmentMark[]
  file?:         File | null
}

function fmt(s: number): string {
  const m  = Math.floor(s / 60)
  const ss = Math.floor(s % 60).toString().padStart(2, '0')
  const ms = Math.floor((s % 1) * 10)
  return `${m}:${ss}.${ms}`
}

function markStyle(
  seg:      SegmentMark,
  trimStart: number,
  duration:  number,
  color:     string,
): React.CSSProperties {
  const leftPct  = Math.max(0, ((trimStart + seg.start) / duration) * 100)
  const rightPct = Math.min(100, ((trimStart + seg.end)   / duration) * 100)
  const widthPct = Math.max(0.3, rightPct - leftPct)
  return {
    position:    'absolute',
    left:        `${leftPct}%`,
    width:       `${widthPct}%`,
    height:      '8px',
    top:         '50%',
    transform:   'translateY(-50%)',
    background:  color,
    borderRadius: 2,
    opacity:     0.55,
    pointerEvents: 'none',
  }
}

const THUMB_COUNT = 8

export default function TrimSlider({ duration, start, end, onChange, silenceMarks = [], manualMarks = [], file }: Props) {
  const [thumbUrls,  setThumbUrls]  = useState<string[]>([])
  const [thumbError, setThumbError] = useState(false)
  const thumbFile = useRef<File | null>(null)

  useEffect(() => {
    if (!file || duration <= 0) {
      setThumbUrls([])
      setThumbError(false)
      return
    }
    if (thumbFile.current === file) return
    thumbFile.current = file

    let cancelled = false
    const objectUrl = URL.createObjectURL(file)
    const video     = document.createElement('video')
    video.muted     = true
    video.src       = objectUrl

    function seekTo(time: number): Promise<void> {
      return new Promise(resolve => {
        const handler = () => { video.removeEventListener('seeked', handler); resolve() }
        video.addEventListener('seeked', handler)
        video.currentTime = time
      })
    }

    async function extract() {
      await new Promise<void>(resolve => {
        video.addEventListener('loadedmetadata', () => resolve(), { once: true })
        video.load()
      })
      const thumbs: string[] = []
      for (let i = 0; i < THUMB_COUNT; i++) {
        if (cancelled) break
        const t = THUMB_COUNT > 1 ? (i / (THUMB_COUNT - 1)) * duration : 0
        await seekTo(t)
        if (cancelled) break
        const canvas = document.createElement('canvas')
        canvas.width  = 80
        canvas.height = 45
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, 80, 45)
          thumbs.push(canvas.toDataURL('image/jpeg', 0.65))
        }
      }
      if (!cancelled) setThumbUrls(thumbs)
    }

    extract().catch(() => {
      if (!cancelled) setThumbError(true)
    })

    return () => {
      cancelled = true
      URL.revokeObjectURL(objectUrl)
      video.src = ''
    }
  }, [file, duration])

  if (duration <= 0) return null

  const startPct = (start / duration) * 100
  const endPct   = (end   / duration) * 100

  const hasMarks = silenceMarks.length > 0 || manualMarks.length > 0

  return (
    <div className="w-full">
      <div className="flex justify-between mb-3 text-xs font-mono" style={{ color: 'var(--primary)' }}>
        <span>{fmt(start)}</span>
        <span style={{ color: 'var(--text-muted)' }}>duration: {fmt(end - start)}</span>
        <span>{fmt(end)}</span>
      </div>

      {thumbUrls.length > 0 && (
        <div
          style={{
            display:      'flex',
            borderRadius: 4,
            overflow:     'hidden',
            height:       34,
            marginBottom: 6,
            opacity:      0.80,
            border:       '1px solid var(--border-subtle)',
          }}
        >
          {thumbUrls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              style={{ flex: 1, objectFit: 'cover', minWidth: 0, display: 'block' }}
            />
          ))}
        </div>
      )}

      <div className="dual-range-container">
        <div className="track-bg" />

        {silenceMarks.map((seg, i) => (
          <div key={`sil-${i}`} style={markStyle(seg, start, duration, '#f59e0b')} />
        ))}
        {manualMarks.map((seg, i) => (
          <div key={`man-${i}`} style={markStyle(seg, start, duration, '#ef4444')} />
        ))}

        <div
          className="track-fill"
          style={{
            left:  `${startPct}%`,
            width: `${endPct - startPct}%`,
          }}
        />
        <input
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={start}
          style={{ background: 'transparent' }}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (v < end - 0.5) onChange(v, end)
          }}
        />
        <input
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={end}
          style={{ background: 'transparent' }}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (v > start + 0.5) onChange(start, v)
          }}
        />
      </div>

      <div className="flex justify-between mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>0:00</span>
        <span>{fmt(duration)}</span>
      </div>

      {thumbError && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
          Thumbnails unavailable for this file.
        </p>
      )}

      {hasMarks && (
        <div className="flex items-center gap-4 mt-2">
          {silenceMarks.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b', opacity: 0.8 }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {silenceMarks.length} silence {silenceMarks.length === 1 ? 'gap' : 'gaps'}
              </span>
            </div>
          )}
          {manualMarks.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', opacity: 0.8 }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {manualMarks.length} manual {manualMarks.length === 1 ? 'cut' : 'cuts'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
