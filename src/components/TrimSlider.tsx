import { useState, useEffect, useRef, useCallback } from 'react'

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

const THUMB_COUNT = 8
const WAVEFORM_BUCKETS = 400
const MAX_AUDIO_BYTES  = 200 * 1024 * 1024
const DECODE_TIMEOUT   = 8000

export default function TrimSlider({
  duration, start, end, onChange,
  silenceMarks = [], manualMarks = [], file,
}: Props) {
  const [thumbUrls,     setThumbUrls]     = useState<string[]>([])
  const [thumbError,    setThumbError]    = useState(false)
  const [waveformPeaks, setWaveformPeaks] = useState<Float32Array | null>(null)
  const thumbFile    = useRef<File | null>(null)
  const waveformRef  = useRef<HTMLCanvasElement>(null)

  // ── Thumbnail extraction ────────────────────────────────────────────────
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

    extract().catch(() => { if (!cancelled) setThumbError(true) })

    return () => {
      cancelled = true
      URL.revokeObjectURL(objectUrl)
      video.src = ''
    }
  }, [file, duration])

  // ── Waveform peak extraction ────────────────────────────────────────────
  useEffect(() => {
    setWaveformPeaks(null)
    if (!file) return
    let cancelled = false
    ;(async () => {
      try {
        const url = URL.createObjectURL(file)
        let buf: ArrayBuffer
        try {
          const res  = await fetch(url)
          const size = parseInt(res.headers.get('content-length') ?? '0', 10)
          if (size > MAX_AUDIO_BYTES) return
          buf = await Promise.race([
            res.arrayBuffer(),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), DECODE_TIMEOUT)),
          ])
        } finally {
          URL.revokeObjectURL(url)
        }
        if (cancelled) return
        let actx: AudioContext | null = null
        try {
          actx = new AudioContext()
          const audio = await Promise.race([
            actx.decodeAudioData(buf),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), DECODE_TIMEOUT)),
          ])
          if (cancelled) return
          const data  = audio.getChannelData(0)
          const step  = Math.max(1, Math.floor(data.length / WAVEFORM_BUCKETS))
          const peaks = new Float32Array(WAVEFORM_BUCKETS)
          for (let i = 0; i < WAVEFORM_BUCKETS; i++) {
            const base = i * step
            let max = 0
            for (let j = 0; j < step; j++) {
              const v = Math.abs(data[base + j] ?? 0)
              if (v > max) max = v
            }
            peaks[i] = max
          }
          if (!cancelled) setWaveformPeaks(peaks)
        } finally {
          actx?.close()
        }
      } catch {
        // Waveform is cosmetic — silently skip
      }
    })()
    return () => { cancelled = true }
  }, [file])

  // ── Waveform canvas draw ────────────────────────────────────────────────
  const drawWaveform = useCallback(() => {
    const canvas = waveformRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    if (!waveformPeaks) {
      // No peaks yet — draw a thin placeholder line
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(0, H / 2 - 1, W, 2)
      return
    }

    const N      = waveformPeaks.length
    const trimS  = duration > 0 ? start / duration : 0
    const trimE  = duration > 0 ? end   / duration : 1
    const barW   = Math.max(1, (W / N) - 0.3)
    const midY   = H / 2

    // Draw waveform bars
    for (let i = 0; i < N; i++) {
      const pos  = i / N
      const barH = Math.max(2, waveformPeaks[i] * H * 0.9)
      if (pos < trimS || pos > trimE) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.28)'
      }
      ctx.fillRect((i / N) * W, midY - barH / 2, barW, barH)
    }

    // Trim region tint
    const tintL = trimS * W
    const tintW = (trimE - trimS) * W
    ctx.fillStyle = 'rgba(211,65,105,0.12)'
    ctx.fillRect(tintL, 0, tintW, H)

    // Silence segments (amber) — coords are relative to start (trimStart)
    for (const seg of silenceMarks) {
      const segAbsStart = start + seg.start
      const segAbsEnd   = start + seg.end
      const l = (segAbsStart / duration) * W
      const w = Math.max(2, ((segAbsEnd - segAbsStart) / duration) * W)
      ctx.fillStyle = 'rgba(245,158,11,0.45)'
      ctx.fillRect(l, 0, w, H)
    }

    // Manual cuts (red)
    for (const seg of manualMarks) {
      const segAbsStart = start + seg.start
      const segAbsEnd   = start + seg.end
      const l = (segAbsStart / duration) * W
      const w = Math.max(2, ((segAbsEnd - segAbsStart) / duration) * W)
      ctx.fillStyle = 'rgba(239,68,68,0.60)'
      ctx.fillRect(l, 0, w, H)
    }

    // Left / right trim shade
    ctx.fillStyle = 'rgba(0,0,0,0.40)'
    if (trimS > 0)     ctx.fillRect(0,         0, tintL,            H)
    if (trimE < 1)     ctx.fillRect(tintL + tintW, 0, W - (tintL + tintW), H)

    // Trim edge markers
    ctx.fillStyle = 'rgba(211,65,105,0.90)'
    ctx.fillRect(tintL,             0, 2, H)
    ctx.fillRect(tintL + tintW - 2, 0, 2, H)
  }, [waveformPeaks, start, end, duration, silenceMarks, manualMarks])

  useEffect(() => { drawWaveform() }, [drawWaveform])

  if (duration <= 0) return null

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

      {/* Waveform + dual-range overlay */}
      <div className="dual-range-container">
        {/* Waveform canvas — full width, sits behind everything */}
        <canvas
          ref={waveformRef}
          width={WAVEFORM_BUCKETS}
          height={28}
          style={{
            position:      'absolute',
            inset:         0,
            width:         '100%',
            height:        '100%',
            borderRadius:  4,
            display:       'block',
            pointerEvents: 'none',
          }}
        />

        {/* Range inputs — pointer-events on thumbs handled by .dual-range-container CSS */}
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
