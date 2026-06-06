import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react'
import Tooltip from './Tooltip'
import type { SilenceSegment } from '../lib/silenceCutter'

function formatTime(s: number): string {
  const m  = Math.floor(s / 60)
  const ss = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}:${ss}`
}

interface Props {
  videoRef:           React.RefObject<HTMLVideoElement | null>
  videoUrl:           string | null
  duration:           number
  trimStart:          number
  trimEnd:            number
  currentTime:        number
  isPlaying:          boolean
  volume:             number
  onVolumeChange:     (v: number) => void
  isMuted:            boolean
  onMutedChange:      (m: boolean) => void
  isFullscreen:       boolean
  onToggleFullscreen: () => void
  onTogglePlay:       () => void
  onSeek:             (time: number) => void
  playError:          string | null
  silenceSegs:        SilenceSegment[]
  removeSilence:      boolean
  manualCuts:         SilenceSegment[]
  maxWidth:           string
}

export default function VideoControls({
  videoRef, videoUrl, duration, trimStart, trimEnd,
  currentTime, isPlaying,
  volume, onVolumeChange, isMuted, onMutedChange,
  isFullscreen, onToggleFullscreen, onTogglePlay, onSeek,
  playError,
  silenceSegs, removeSilence, manualCuts,
  maxWidth,
}: Props) {
  const [isDragging,    setIsDragging]    = useState(false)
  const [waveformPeaks, setWaveformPeaks] = useState<Float32Array | null>(null)

  const sliderRef         = useRef<HTMLDivElement>(null)
  const waveformRef       = useRef<HTMLCanvasElement>(null)
  const loudnessCanvasRef = useRef<HTMLCanvasElement>(null)
  const dbReadoutRef      = useRef<HTMLSpanElement>(null)
  const analyserRef       = useRef<AnalyserNode | null>(null)
  const audioCtxRef       = useRef<AudioContext | null>(null)
  const loudnessRafRef    = useRef<number>(0)
  const peakDbRef         = useRef<number>(-60)
  const peakHoldTimeRef   = useRef<number>(0)
  const analyserBufRef    = useRef<Float32Array | null>(null)

  const trimStartRef = useRef(trimStart)
  const trimEndRef   = useRef(trimEnd)
  const durationRef  = useRef(duration)
  useEffect(() => { trimStartRef.current = trimStart }, [trimStart])
  useEffect(() => { trimEndRef.current   = trimEnd   }, [trimEnd])
  useEffect(() => { durationRef.current  = duration  }, [duration])

  useEffect(() => {
    setWaveformPeaks(null)
    if (!videoUrl) return
    let cancelled = false
    const BUCKETS   = 600
    const MAX_BYTES = 200 * 1024 * 1024
    const TIMEOUT   = 6000
    ;(async () => {
      try {
        // blob: URLs do not support HEAD. Use a GET and check Content-Length
        // from the response before reading the body.
        const res = await fetch(videoUrl)
        const size = parseInt(res.headers.get('content-length') ?? '0', 10)
        if (size > MAX_BYTES) return
        const buf: ArrayBuffer = await Promise.race([
          res.arrayBuffer(),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT)),
        ])
        if (cancelled) return
        let actx: AudioContext | null = null
        try {
          actx = new AudioContext()
          const audio: AudioBuffer = await Promise.race([
            actx.decodeAudioData(buf),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT)),
          ])
          if (cancelled) return
          const data = audio.getChannelData(0)
          const step = Math.max(1, Math.floor(data.length / BUCKETS))
          const peaks = new Float32Array(BUCKETS)
          for (let i = 0; i < BUCKETS; i++) {
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
        // Waveform is cosmetic: silently skip on any error or timeout
      }
    })()
    return () => { cancelled = true }
  }, [videoUrl])

  useEffect(() => {
    const canvas = waveformRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)
    const peaks = waveformPeaks
    if (!peaks) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(0, H / 2 - 1, W, 2)
      return
    }
    const N    = peaks.length
    const midY = H / 2
    const trimS  = duration > 0 ? trimStart   / duration : 0
    const trimE  = duration > 0 ? trimEnd     / duration : 1
    const played = duration > 0 ? currentTime / duration : 0
    const barW   = Math.max(1, (W / N) - 0.5)
    for (let i = 0; i < N; i++) {
      const pos  = i / N
      const barH = Math.max(1.5, peaks[i] * H * 0.88)
      if (pos < trimS || pos > trimE) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)'
      } else if (pos <= played) {
        ctx.fillStyle = 'rgba(211,65,105,0.70)'
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.22)'
      }
      ctx.fillRect((i / N) * W, midY - barH / 2, barW, barH)
    }
  }, [waveformPeaks, currentTime, trimStart, trimEnd, duration])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !videoUrl || audioCtxRef.current) return
    try {
      const ctx     = new AudioContext()
      const src     = ctx.createMediaElementSource(v)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.55
      src.connect(analyser)
      analyser.connect(ctx.destination)
      audioCtxRef.current  = ctx
      analyserRef.current  = analyser
    } catch {
      // Meter is cosmetic; some browsers block AudioContext
    }
  }, [videoUrl, videoRef])

  useEffect(() => {
    const GREEN_END  = 0.70
    const YELLOW_END = 0.90

    const clearMeter = () => {
      const canvas = loudnessCanvasRef.current
      if (!canvas) return
      const c = canvas.getContext('2d')
      if (!c) return
      c.clearRect(0, 0, canvas.width, canvas.height)
      c.fillStyle = 'rgba(255,255,255,0.07)'
      c.fillRect(0, 0, canvas.width, canvas.height)
      if (dbReadoutRef.current) dbReadoutRef.current.textContent = '--'
    }

    if (!isPlaying) {
      if (loudnessRafRef.current) cancelAnimationFrame(loudnessRafRef.current)
      clearMeter()
      return
    }

    audioCtxRef.current?.resume().catch(() => {})

    const draw = () => {
      const analyser = analyserRef.current
      const canvas   = loudnessCanvasRef.current
      if (!analyser || !canvas) { loudnessRafRef.current = requestAnimationFrame(draw); return }
      const c = canvas.getContext('2d')
      if (!c) { loudnessRafRef.current = requestAnimationFrame(draw); return }

      const W = canvas.width
      const H = canvas.height

      const fftSize = analyser.fftSize
      if (!analyserBufRef.current || analyserBufRef.current.length !== fftSize) {
        analyserBufRef.current = new Float32Array(fftSize)
      }
      analyser.getFloatTimeDomainData(analyserBufRef.current as Float32Array<ArrayBuffer>)
      let sum = 0
      for (let i = 0; i < fftSize; i++) {
        const s = analyserBufRef.current[i]
        sum += s * s
      }
      const rms  = Math.sqrt(sum / fftSize)
      const dbFs = rms > 0.0001 ? Math.max(-60, 20 * Math.log10(rms)) : -60

      const now = performance.now()
      if (dbFs > peakDbRef.current) {
        peakDbRef.current       = dbFs
        peakHoldTimeRef.current = now
      } else if (now - peakHoldTimeRef.current > 1500) {
        peakDbRef.current = Math.max(dbFs, peakDbRef.current - 0.1)
      }

      c.clearRect(0, 0, W, H)
      c.fillStyle = 'rgba(255,255,255,0.07)'
      c.fillRect(0, 0, W, H)

      const levelFrac = Math.max(0, Math.min(1, (dbFs + 60) / 60))
      const levelH    = levelFrac * H
      const greenH    = Math.min(levelH, GREEN_END * H)
      const yellowH   = levelH > GREEN_END * H
        ? Math.min(levelH - GREEN_END * H, (YELLOW_END - GREEN_END) * H) : 0
      const redH      = levelH > YELLOW_END * H ? levelH - YELLOW_END * H : 0

      if (greenH  > 0) { c.fillStyle = '#10b981'; c.fillRect(0, H - greenH,              W, greenH) }
      if (yellowH > 0) { c.fillStyle = '#f59e0b'; c.fillRect(0, H - GREEN_END * H - yellowH, W, yellowH) }
      if (redH    > 0) { c.fillStyle = '#ef4444'; c.fillRect(0, H - levelH,              W, redH) }

      const peakFrac = Math.max(0, Math.min(1, (peakDbRef.current + 60) / 60))
      if (peakFrac > 0.02) {
        const peakY = Math.round(H - peakFrac * H)
        c.fillStyle = peakDbRef.current > -6 ? '#ef4444' : 'rgba(255,255,255,0.75)'
        c.fillRect(0, peakY, W, 1)
      }

      if (dbReadoutRef.current) {
        dbReadoutRef.current.textContent = dbFs > -59 ? `${Math.round(dbFs)}` : '-\u221e'
      }
      loudnessRafRef.current = requestAnimationFrame(draw)
    }

    loudnessRafRef.current = requestAnimationFrame(draw)
    return () => { if (loudnessRafRef.current) cancelAnimationFrame(loudnessRafRef.current) }
  }, [isPlaying])

  const handleSeek = (clientX: number) => {
    const el = sliderRef.current
    if (!el || durationRef.current <= 0) return
    const rect = el.getBoundingClientRect()
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const rawTime    = pct * durationRef.current
    const targetTime = Math.max(trimStartRef.current, Math.min(trimEndRef.current, rawTime))
    const v = videoRef.current
    if (v) {
      v.currentTime = targetTime
      onSeek(targetTime)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    handleSeek(e.clientX)
  }

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => handleSeek(e.clientX)
    const onUp   = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [isDragging])

  const trimStartPct = duration > 0 ? (trimStart   / duration) * 100 : 0
  const trimEndPct   = duration > 0 ? (trimEnd     / duration) * 100 : 100
  const playheadPct  = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  // Tighten layout on portrait / square previews (< 400 px wide)
  const isNarrow = parseInt(maxWidth, 10) < 400

  return (
    <div
      style={{
        width:          '100%',
        maxWidth:       maxWidth,
        background:     'var(--bg-panel, #1c1c24)',
        borderRadius:   '0 0 12px 12px',
        borderTop:      '1px solid rgba(255,255,255,0.06)',
        padding:        isNarrow ? '6px 10px' : '8px 12px',
        display:        'flex',
        flexDirection:  'column',
        gap:            5,
      }}
    >
      {playError && (
        <div style={{ fontSize: 10, color: '#ef4444', paddingBottom: 2 }}>
          {playError}
        </div>
      )}

      {/* Waveform / seek bar */}
      <div
        ref={sliderRef}
        onMouseDown={handleMouseDown}
        style={{
          position:   'relative',
          height:     isNarrow ? 28 : 36,
          display:    'flex',
          alignItems: 'center',
          cursor:     'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ width: '100%', height: isNarrow ? 22 : 28, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
          <canvas
            ref={waveformRef}
            width={600}
            height={28}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
          />

          {removeSilence && silenceSegs.map((seg, i) => {
            const left  = ((trimStart + seg.start) / duration) * 100
            const width = ((seg.end - seg.start) / duration) * 100
            return (
              <div
                key={`sil-${i}`}
                title="Silence cut segment"
                style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, height: '100%', background: '#f59e0b', opacity: 0.45, borderRadius: 1 }}
              />
            )
          })}

          {manualCuts.map((seg, i) => {
            const left  = ((trimStart + seg.start) / duration) * 100
            const width = Math.max(0.8, ((seg.end - seg.start) / duration) * 100)
            return (
              <div
                key={`man-${i}`}
                title="Manual cut segment"
                style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, height: '100%', background: '#ef4444', opacity: 0.75, borderRadius: 1 }}
              />
            )
          })}

          <div style={{ position: 'absolute', left: `${trimStartPct}%`, width: `${Math.max(0, trimEndPct - trimStartPct)}%`, height: '100%', background: 'rgba(211,65,105,0.35)', borderRadius: 2 }} />

          <div style={{ position: 'absolute', left: `${playheadPct}%`, top: '50%', width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', border: '2.5px solid #ffffff', boxShadow: '0 0 4px rgba(0,0,0,0.4)', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Playback controls row — single line at all widths */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'nowrap', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isNarrow ? 7 : 12, flexShrink: 0 }}>
          <Tooltip text={isPlaying ? 'Pause' : 'Play'} position="top">
            <button
              onClick={onTogglePlay}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s ease', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = '#ffffff')}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>
          </Tooltip>

          <span style={{ fontSize: 10, fontFamily: "'SF Mono','Fira Code',monospace", color: 'rgba(255,255,255,0.54)', userSelect: 'none', whiteSpace: 'nowrap' }}>
            {formatTime(Math.max(0, currentTime - trimStart))} / {formatTime(Math.max(0, trimEnd - trimStart))}
          </span>

          {videoUrl && !isNarrow && (
            <span
              style={{ fontSize: 9, fontFamily: "'SF Mono','Fira Code',monospace", color: 'rgba(255,255,255,0.25)', userSelect: 'none', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}
              title="Space: play/pause, Arrow keys: step one frame"
            >
              Space&nbsp;&#x00B7;&nbsp;&#x2190;&#x2192;
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isNarrow ? 7 : 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Tooltip text={isMuted || volume === 0 ? 'Unmute' : 'Mute'} position="top">
              <button
                onClick={() => onMutedChange(!isMuted)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.54)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s ease', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.54)')}
              >
                {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </Tooltip>

            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={e => onVolumeChange(parseFloat(e.target.value))}
              style={{ width: isNarrow ? 36 : 50, height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 1.5, cursor: 'pointer', flexShrink: 0 }}
            />
          </div>

          {videoUrl && !isNarrow && (
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0 }}
              title="Real-time loudness (dBFS). Green: below -18, Yellow: -18 to -6, Red: above -6"
            >
              <canvas ref={loudnessCanvasRef} width={8} height={28} style={{ display: 'block', borderRadius: 2 }} />
              <span
                ref={dbReadoutRef}
                style={{ fontSize: 8, fontFamily: "'SF Mono','Fira Code',monospace", color: 'rgba(255,255,255,0.28)', userSelect: 'none', lineHeight: 1, minWidth: 16, textAlign: 'center' }}
              >
                --
              </span>
            </div>
          )}

          <Tooltip text={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} position="top">
            <button
              onClick={onToggleFullscreen}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.54)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s ease', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.54)')}
            >
              {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
