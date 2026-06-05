import { useEffect, useRef, useState } from 'react'
import type { BlurRegion } from './FaceBlurPanel'
import type { Ratio, CropMode } from '../lib/ffmpeg'
import type { SilenceSegment } from '../lib/silenceCutter'
import type { WatermarkConfig } from './WatermarkPanel'
import type { CaptionGroup, CaptionStyle } from '../lib/captionEngine'
import BlurRegionOverlay from './BlurRegionOverlay'
import VideoControls from './VideoControls'
import CaptionOverlay from './CaptionOverlay'

interface Props {
  videoRef:     React.RefObject<HTMLVideoElement | null>
  videoUrl:     string | null
  trimStart:    number
  trimEnd:      number
  duration:     number
  blurRegions:  BlurRegion[]
  ratio:        Ratio
  cropMode:     CropMode
  silenceSegs:  SilenceSegment[]
  removeSilence: boolean
  manualCuts?:  SilenceSegment[]
  watermark?:   WatermarkConfig | null
  isDrawingBlur?: boolean
  onAddBlurRegion?: (region: Omit<BlurRegion, 'id'>) => void
  onStopDrawingBlur?: () => void
  captionGroups?: CaptionGroup[]
  captionStyle?:  CaptionStyle
}

function wmPreviewStyle(
  pos: WatermarkConfig['position'],
  scale: number,
  opacity: number,
  margin: number,
  containerH: number,
): React.CSSProperties {
  const m = Math.max(4, Math.round(margin * containerH / 720))
  const base: React.CSSProperties = {
    position:   'absolute',
    width:      `${scale}%`,
    maxHeight:  '40%',
    opacity,
    pointerEvents: 'none',
    zIndex:     3,
    objectFit:  'contain',
  }
  switch (pos) {
    case 'top-left':     return { ...base, top: m,    left:  m }
    case 'top-right':    return { ...base, top: m,    right: m }
    case 'bottom-left':  return { ...base, bottom: m, left:  m }
    case 'bottom-right': return { ...base, bottom: m, right: m }
    case 'center':       return { ...base, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
  }
}

export default function VideoPreview({
  videoRef, videoUrl,
  trimStart, trimEnd, duration, blurRegions, ratio, cropMode,
  silenceSegs, removeSilence,
  manualCuts = [],
  watermark,
  isDrawingBlur = false, onAddBlurRegion, onStopDrawingBlur,
  captionGroups = [],
  captionStyle,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const fullscreenRef = useRef<HTMLDivElement>(null)

  const [containerH,   setContainerH]   = useState(360)
  const [currentTime,  setCurrentTime]  = useState(0)
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [volume,       setVolume]       = useState(1)
  const [isMuted,      setIsMuted]      = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoaded,     setIsLoaded]     = useState(false)
  const [nativeVideoW, setNativeVideoW] = useState(0)
  const [nativeVideoH, setNativeVideoH] = useState(0)
  const [playError,    setPlayError]    = useState<string | null>(null)

  // Watermark preview blob URL
  const [watermarkPreviewUrl, setWatermarkPreviewUrl] = useState<string | null>(null)
  const watermarkUrlRef = useRef<string | null>(null)
  useEffect(() => {
    if (watermarkUrlRef.current) { URL.revokeObjectURL(watermarkUrlRef.current); watermarkUrlRef.current = null }
    if (watermark?.file) {
      const url = URL.createObjectURL(watermark.file)
      watermarkUrlRef.current = url
      setWatermarkPreviewUrl(url)
    } else {
      setWatermarkPreviewUrl(null)
    }
    return () => {
      if (watermarkUrlRef.current) { URL.revokeObjectURL(watermarkUrlRef.current); watermarkUrlRef.current = null }
    }
  }, [watermark?.file])

  // Refs needed by the playback loop (always-fresh cut data without re-registering)
  const manualCutsRef     = useRef(manualCuts)
  const silenceSegsRef    = useRef(silenceSegs)
  const removeSilenceRef  = useRef(removeSilence)
  useEffect(() => { manualCutsRef.current     = manualCuts     }, [manualCuts])
  useEffect(() => { silenceSegsRef.current    = silenceSegs    }, [silenceSegs])
  useEffect(() => { removeSilenceRef.current  = removeSilence  }, [removeSilence])

  const trimStartRef = useRef(trimStart)
  const trimEndRef   = useRef(trimEnd)
  const durationRef  = useRef(duration)
  useEffect(() => { trimStartRef.current = trimStart }, [trimStart])
  useEffect(() => { trimEndRef.current   = trimEnd   }, [trimEnd])
  useEffect(() => { durationRef.current  = duration  }, [duration])

  // Track container height for watermark scaling
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect.height
      if (h && h > 10) setContainerH(h)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Monitor fullscreen change events
  useEffect(() => {
    const onFsc = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsc)
    return () => document.removeEventListener('fullscreenchange', onFsc)
  }, [])

  // Keyboard shortcuts: Space, Left, Right
  useEffect(() => {
    if (!videoUrl) return
    const FRAME = 1 / 30
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
      const v = videoRef.current
      if (!v) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (v.paused) {
          if (v.currentTime >= trimEndRef.current) v.currentTime = trimStartRef.current
          v.play().catch(() => {})
        } else {
          v.pause()
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        v.pause()
        v.currentTime = Math.max(trimStartRef.current, v.currentTime - FRAME)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        v.pause()
        v.currentTime = Math.min(trimEndRef.current, v.currentTime + FRAME)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [videoUrl, videoRef])

  // Apply volume to video element
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = isMuted ? 0 : volume
  }, [volume, isMuted, videoUrl, videoRef])

  // Reset isLoaded when URL changes
  useEffect(() => {
    const v = videoRef.current
    if (!v) { setIsLoaded(false); return }
    setIsLoaded(v.readyState >= 2)
  }, [videoUrl, videoRef])

  // Sync playback time and enforce trim bounds + cut skipping
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    let frameId: number

    const updatePlayhead = () => {
      const tNow = v.currentTime
      if (tNow >= trimEnd) {
        v.currentTime = trimStart
        setCurrentTime(trimStart)
      } else {
        const ts = trimStartRef.current
        const cuts: [number, number][] = [
          ...manualCutsRef.current.map(s => [ts + s.start, ts + s.end] as [number, number]),
          ...(removeSilenceRef.current
            ? silenceSegsRef.current.map(s => [ts + s.start, ts + s.end] as [number, number])
            : []),
        ]
        const activeCut = cuts.find(([s, e]) => tNow >= s && tNow < e)
        if (activeCut) {
          const skipTo = Math.min(activeCut[1], trimEndRef.current)
          v.currentTime = skipTo
          setCurrentTime(skipTo)
        } else {
          setCurrentTime(tNow)
        }
      }
      if (!v.paused) frameId = requestAnimationFrame(updatePlayhead)
    }

    const onPlay      = () => { setIsPlaying(true);  frameId = requestAnimationFrame(updatePlayhead) }
    const onPause     = () => { setIsPlaying(false);  if (frameId) cancelAnimationFrame(frameId); setCurrentTime(v.currentTime) }
    const onTimeUpdate = () => { if (v.paused) setCurrentTime(v.currentTime) }
    const onLoaded    = () => setIsLoaded(true)

    v.addEventListener('play',        onPlay)
    v.addEventListener('pause',       onPause)
    v.addEventListener('timeupdate',  onTimeUpdate)
    v.addEventListener('seeked',      onTimeUpdate)
    v.addEventListener('loadeddata',  onLoaded)

    if (!v.paused) frameId = requestAnimationFrame(updatePlayhead)

    return () => {
      v.removeEventListener('play',        onPlay)
      v.removeEventListener('pause',       onPause)
      v.removeEventListener('timeupdate',  onTimeUpdate)
      v.removeEventListener('seeked',      onTimeUpdate)
      v.removeEventListener('loadeddata',  onLoaded)
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [videoUrl, videoRef, trimStart, trimEnd])

  // Clamp playhead when trim bounds change
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (v.currentTime < trimStart || v.currentTime > trimEnd) {
      v.currentTime = trimStart
      setCurrentTime(trimStart)
    }
  }, [trimStart, trimEnd, videoRef])

  // Disable any embedded text/subtitle tracks so they don't render over the video
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const disableTextTracks = () => {
      for (let i = 0; i < v.textTracks.length; i++) {
        v.textTracks[i].mode = 'disabled'
      }
    }
    disableTextTracks()
    v.addEventListener('loadedmetadata', disableTextTracks)
    return () => v.removeEventListener('loadedmetadata', disableTextTracks)
  }, [videoUrl, videoRef])

  // Capture native video dimensions
  useEffect(() => {
    const v = videoRef.current
    if (!v) { setNativeVideoW(0); setNativeVideoH(0); return }
    const onMeta = () => { setNativeVideoW(v.videoWidth); setNativeVideoH(v.videoHeight) }
    v.addEventListener('loadedmetadata', onMeta)
    if (v.readyState >= 1 && v.videoWidth > 0) onMeta()
    return () => v.removeEventListener('loadedmetadata', onMeta)
  }, [videoUrl, videoRef])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    setPlayError(null)
    if (v.paused) {
      if (v.currentTime >= trimEnd) v.currentTime = trimStart
      v.play().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        setPlayError(`Playback blocked: ${msg}. Try clicking directly on the video.`)
      })
    } else {
      v.pause()
    }
  }

  const toggleFullscreen = () => {
    const el = fullscreenRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        setPlayError(`Fullscreen not available: ${msg}`)
        setTimeout(() => setPlayError(null), 4000)
      })
    } else {
      document.exitFullscreen().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        setPlayError(`Could not exit fullscreen: ${msg}`)
        setTimeout(() => setPlayError(null), 4000)
      })
    }
  }

  // Aspect ratio container style
  const aspectStyle: React.CSSProperties =
    ratio === '9:16' ? { aspectRatio: '9/16',  maxWidth: '292px' }
    : ratio === '1:1'  ? { aspectRatio: '1/1',   maxWidth: '520px' }
    : ratio === '4:5'  ? { aspectRatio: '4/5',   maxWidth: '416px' }
    : { aspectRatio: '16/9', maxWidth: '640px' }

  // Ratio mismatch overlays
  const RATIO_AR_MAP: Record<string, number> = { '16:9': 16/9, '9:16': 9/16, '1:1': 1, '4:5': 4/5 }
  const containerAR = RATIO_AR_MAP[ratio] ?? 16/9
  const nativeAR    = nativeVideoW > 0 && nativeVideoH > 0 ? nativeVideoW / nativeVideoH : null
  const AR_GAP      = 0.04

  let fitBarDir:  'topbottom' | 'leftright' | null = null
  let fitBarFrac  = 0
  let fillCropPct = 0

  if (nativeAR !== null && Math.abs(nativeAR - containerAR) > AR_GAP) {
    const minAR = Math.min(nativeAR, containerAR)
    const maxAR = Math.max(nativeAR, containerAR)
    fitBarFrac  = (1 - minAR / maxAR) / 2
    fillCropPct = Math.round((1 - minAR / maxAR) * 100)
    fitBarDir   = nativeAR > containerAR ? 'topbottom' : 'leftright'
  }

  const activeCutCount =
    manualCuts.length +
    (removeSilence ? silenceSegs.length : 0)
  const cutsActive = activeCutCount > 0

  const hasControls = !!videoUrl && duration > 0
  const videoBR     = hasControls ? '12px 12px 0 0' : '12px'

  return (
    <div
      ref={fullscreenRef}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
    >
      <div style={{ position: 'relative', ...aspectStyle, width: '100%' }}>
        {/* Checkerboard background */}
        <div style={{
          position:        'absolute',
          inset:           0,
          borderRadius:    videoBR,
          backgroundImage: 'linear-gradient(45deg,#18181f 25%,transparent 25%,transparent 75%,#18181f 75%),' +
                           'linear-gradient(45deg,#18181f 25%,#111119 25%,#111119 75%,#18181f 75%)',
          backgroundSize:     '14px 14px',
          backgroundPosition: '0 0,7px 7px',
        }} />

        <div
          ref={containerRef}
          style={{ position: 'absolute', inset: 0, borderRadius: videoBR, overflow: 'hidden' }}
        >
          {videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              preload="metadata"
              onClick={togglePlay}
              style={{
                width:      '100%',
                height:     '100%',
                objectFit:  cropMode === 'fill' ? 'cover' : 'contain',
                background: 'transparent',
                display:    'block',
                cursor:     'pointer',
              }}
            />
          )}

          {/* Fit-mode letterbox / pillarbox overlay */}
          {cropMode === 'fit' && fitBarDir !== null && videoUrl && (() => {
            const pctStr  = `${(fitBarFrac * 100).toFixed(0)}%`
            const showLbl = fitBarFrac >= 0.08
            const barBase: React.CSSProperties = {
              position: 'absolute', background: 'rgba(0,0,0,0.65)', pointerEvents: 'none',
              zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }
            const lbl: React.CSSProperties = {
              fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.07em',
              textTransform: 'uppercase' as const, fontFamily: "'SF Mono', monospace",
            }
            return fitBarDir === 'topbottom' ? (
              <>
                <div style={{ ...barBase, top: 0, left: 0, right: 0, height: `${fitBarFrac * 100}%` }}>
                  {showLbl && <span style={lbl}>black bar · {pctStr}</span>}
                </div>
                <div style={{ ...barBase, bottom: 0, left: 0, right: 0, height: `${fitBarFrac * 100}%` }}>
                  {showLbl && <span style={lbl}>black bar · {pctStr}</span>}
                </div>
              </>
            ) : (
              <>
                <div style={{ ...barBase, top: 0, bottom: 0, left: 0, width: `${fitBarFrac * 100}%` }} />
                <div style={{ ...barBase, top: 0, bottom: 0, right: 0, width: `${fitBarFrac * 100}%` }} />
              </>
            )
          })()}

          {/* Fill-mode crop guide */}
          {cropMode === 'fill' && fillCropPct > 3 && videoUrl && (
            <>
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4 }}>
                {([
                  { top:    8, left:  8, borderTop:    '2px solid rgba(255,255,255,0.45)', borderLeft:   '2px solid rgba(255,255,255,0.45)' },
                  { top:    8, right: 8, borderTop:    '2px solid rgba(255,255,255,0.45)', borderRight:  '2px solid rgba(255,255,255,0.45)' },
                  { bottom: 8, left:  8, borderBottom: '2px solid rgba(255,255,255,0.45)', borderLeft:   '2px solid rgba(255,255,255,0.45)' },
                  { bottom: 8, right: 8, borderBottom: '2px solid rgba(255,255,255,0.45)', borderRight:  '2px solid rgba(255,255,255,0.45)' },
                ] as React.CSSProperties[]).map((s, i) => (
                  <div key={i} style={{ position: 'absolute', width: 14, height: 14, ...s }} />
                ))}
              </div>
              <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 9, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(15,15,20,0.82)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 7px', pointerEvents: 'none' }}>
                <span style={{ fontSize: 9, fontFamily: "'SF Mono','Fira Code',monospace", color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em' }}>
                  ~{fillCropPct}% outside frame
                </span>
              </div>
            </>
          )}

          {/* Cut-preview active badge */}
          {cutsActive && videoUrl && (
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 9, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(15,15,20,0.82)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 6, padding: '3px 8px', pointerEvents: 'none' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ fontSize: 10, fontFamily: "'SF Mono','Fira Code',monospace", color: 'rgba(255,255,255,0.75)', letterSpacing: '0.04em' }}>
                {activeCutCount} cut{activeCutCount !== 1 ? 's' : ''} previewed
              </span>
            </div>
          )}

          {/* Loading spinner */}
          {!isLoaded && videoUrl && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#363640', gap: 12, zIndex: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--primary-a10)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.54)' }}>Loading video preview...</span>
            </div>
          )}

          {/* Watermark preview */}
          {watermarkPreviewUrl && watermark && videoUrl && (
            <img
              src={watermarkPreviewUrl}
              alt=""
              style={wmPreviewStyle(watermark.position, watermark.scale, watermark.opacity, watermark.margin ?? 10, containerH)}
            />
          )}

          <BlurRegionOverlay
            blurRegions={blurRegions}
            isDrawingBlur={isDrawingBlur}
            onAddBlurRegion={onAddBlurRegion}
            onStopDrawingBlur={onStopDrawingBlur}
            containerRef={containerRef}
          />

          {captionGroups.length > 0 && captionStyle && (
            <CaptionOverlay
              videoRef={videoRef}
              captionGroups={captionGroups}
              captionStyle={captionStyle}
            />
          )}
        </div>
      </div>

      {hasControls && (
        <VideoControls
          videoRef={videoRef}
          videoUrl={videoUrl}
          duration={duration}
          trimStart={trimStart}
          trimEnd={trimEnd}
          currentTime={currentTime}
          isPlaying={isPlaying}
          volume={volume}
          onVolumeChange={v => { setVolume(v); if (v > 0) setIsMuted(false) }}
          isMuted={isMuted}
          onMutedChange={setIsMuted}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onTogglePlay={togglePlay}
          onSeek={t => setCurrentTime(t)}
          playError={playError}
          silenceSegs={silenceSegs}
          removeSilence={removeSilence}
          manualCuts={manualCuts}
          maxWidth={aspectStyle.maxWidth as string}
        />
      )}
    </div>
  )
}
