/**
 * Canvas Composite Exporter
 *
 * Draws video frames + captions onto an offscreen canvas, captured via MediaRecorder.
 * Audio is pulled from the original video element's src using a separate Audio element
 * routed through Web Audio API — avoids InvalidStateError from double-connecting.
 *
 * Features applied during export to match the live preview:
 *   - Crop mode  (fit = letterbox/pillarbox, fill = cover crop)
 *   - Blur regions  (pixelation block over sensitive areas)
 *   - Watermark overlay  (image at position/scale/opacity)
 *   - Manual cuts + silence removal  (time-range skipping)
 *   - Captions  (composited on every frame)
 */
import { drawCaptions, getActiveCaption } from './captionEngine'
import type { CaptionGroup, CaptionStyle } from './captionEngine'
import type { BlurRegion }      from '../components/FaceBlurPanel'
import type { WatermarkConfig } from '../components/WatermarkPanel'
import type { SilenceSegment }  from './silenceCutter'
import type { CropMode }        from './ffmpeg'

interface ExportOptions {
  videoElement:   HTMLVideoElement
  captionGroups:  CaptionGroup[]
  captionStyle:   CaptionStyle
  onProgress?:    (progress: number) => void
  targetWidth?:   number | null
  targetHeight?:  number | null
  trimStart?:     number
  trimEnd?:       number | null
  cropMode?:      CropMode
  blurRegions?:   BlurRegion[]
  watermark?:     WatermarkConfig | null
  manualCuts?:    SilenceSegment[]
  silenceSegs?:   SilenceSegment[]
  removeSilence?: boolean
}

type AudioVideoEl = HTMLVideoElement & { _audioEl?: HTMLAudioElement }

export async function exportVideoWithCaptions({
  videoElement,
  captionGroups,
  captionStyle,
  onProgress,
  targetWidth   = null,
  targetHeight  = null,
  trimStart     = 0,
  trimEnd       = null,
  cropMode      = 'fit',
  blurRegions   = [],
  watermark     = null,
  manualCuts    = [],
  silenceSegs   = [],
  removeSilence = false,
}: ExportOptions): Promise<Blob> {

  // ── Pre-load watermark image (async, before Promise) ──────────────────
  let wmImage: HTMLImageElement | null = null
  if (watermark?.file) {
    const wmUrl = URL.createObjectURL(watermark.file)
    wmImage = await new Promise<HTMLImageElement | null>((res) => {
      const img = new Image()
      img.onload  = () => { URL.revokeObjectURL(wmUrl); res(img) }
      img.onerror = () => { URL.revokeObjectURL(wmUrl); res(null) }
      img.src = wmUrl
    })
  }

  // ── Build skip ranges (absolute video time) ────────────────────────────
  // manualCuts and silenceSegs store times relative to trimStart,
  // matching how VideoPreview applies them: [trimStart + s.start, trimStart + s.end]
  const skipRanges: [number, number][] = [
    ...manualCuts.map(c => [trimStart + c.start, trimStart + c.end] as [number, number]),
    ...(removeSilence
      ? silenceSegs.map(c => [trimStart + c.start, trimStart + c.end] as [number, number])
      : []),
  ]

  return new Promise((resolve, reject) => {
    // Use a fresh video clone for frame rendering.
    // Do NOT set crossOrigin — the src is a blob URL (same-origin) and crossOrigin
    // causes the browser to issue a CORS request that blob URLs cannot satisfy.
    const video = document.createElement('video')
    video.src       = videoElement.src
    video.muted     = true
    video.playsInline = true

    const vw = targetWidth  || videoElement.videoWidth  || 1280
    const vh = targetHeight || videoElement.videoHeight || 720

    const canvas = document.createElement('canvas')
    canvas.width  = vw
    canvas.height = vh
    const ctx = canvas.getContext('2d')!

    // Pre-created pixel canvas for blur (avoid per-frame allocation)
    const pixCanvas = document.createElement('canvas')
    const pixCtx    = pixCanvas.getContext('2d')!

    // Scale caption style to canvas resolution (1080p baseline)
    const scaleFactor = vh / 1080
    const scaledStyle = {
      ...captionStyle,
      fontSize:    Math.round(captionStyle.fontSize    * scaleFactor),
      strokeWidth: Math.round(captionStyle.strokeWidth * scaleFactor),
      shadowBlur:  Math.round(captionStyle.shadowBlur  * scaleFactor),
      bgRadius:    Math.round(captionStyle.bgRadius     * scaleFactor),
    }

    const canvasStream = canvas.captureStream(30)

    // ── Audio capture ───────────────────────────────────────────────────
    let audioCtx:    AudioContext | null                 = null
    let audioSource: MediaElementAudioSourceNode | null = null

    try {
      const audioEl  = new Audio()
      audioEl.src    = videoElement.src
      audioEl.muted  = false

      audioCtx    = new AudioContext()
      audioSource = audioCtx.createMediaElementSource(audioEl)
      const audioDest = audioCtx.createMediaStreamDestination()
      audioSource.connect(audioDest)
      audioDest.stream.getAudioTracks().forEach(t => canvasStream.addTrack(t))

      ;(video as AudioVideoEl)._audioEl = audioEl
    } catch (e) {
      console.warn('Audio capture unavailable, exporting video-only:', (e as Error).message)
      if (audioCtx) { audioCtx.close(); audioCtx = null }
    }

    // ── MediaRecorder ───────────────────────────────────────────────────
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm'

    const recorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
    })

    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

    recorder.onstop = () => {
      if (audioCtx) {
        try { audioSource?.disconnect(); audioCtx.close() } catch (_) {}
      }
      resolve(new Blob(chunks, { type: 'video/webm' }))
    }

    recorder.onerror = (e) => reject(new Error(
      'MediaRecorder error: ' +
      ((e as Event & { error?: { message?: string } }).error?.message || 'unknown')
    ))

    // ── Draw helpers ────────────────────────────────────────────────────

    /** Render the current video frame to canvas, respecting cropMode. */
    function drawVideoFrame() {
      ctx.clearRect(0, 0, vw, vh)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, vw, vh)

      const srcW = video.videoWidth
      const srcH = video.videoHeight
      if (!srcW || !srcH) { ctx.drawImage(video, 0, 0, vw, vh); return }

      if (cropMode === 'fill') {
        // Cover: scale so video fills entire canvas, overhang is clipped
        const scale = Math.max(vw / srcW, vh / srcH)
        ctx.drawImage(video, (vw - srcW * scale) / 2, (vh - srcH * scale) / 2, srcW * scale, srcH * scale)
      } else {
        // Fit/contain: letterbox or pillarbox with black bars
        const scale = Math.min(vw / srcW, vh / srcH)
        ctx.drawImage(video, (vw - srcW * scale) / 2, (vh - srcH * scale) / 2, srcW * scale, srcH * scale)
      }
    }

    /**
     * Draw blur regions as pixelated blocks over the already-rendered frame.
     * Coordinates are 0–100% of the output canvas (top-left origin),
     * matching the BlurRegionOverlay coordinate system in the preview.
     */
    function drawBlurRegions() {
      if (!blurRegions.length) return
      // Pixel block size: ~2.5% of the shorter canvas dimension
      const PIXEL_SIZE = Math.max(8, Math.round(Math.min(vw, vh) * 0.025))

      for (const r of blurRegions) {
        const bx = Math.floor(r.x / 100 * vw)
        const by = Math.floor(r.y / 100 * vh)
        const bw = Math.ceil( r.w / 100 * vw)
        const bh = Math.ceil( r.h / 100 * vh)
        if (bw <= 0 || bh <= 0) continue

        // Downscale the region to a tiny resolution, then upscale without
        // smoothing — produces a pixelation/mosaic blur effect.
        const tW = Math.max(1, Math.round(bw / PIXEL_SIZE))
        const tH = Math.max(1, Math.round(bh / PIXEL_SIZE))
        pixCanvas.width  = tW
        pixCanvas.height = tH
        pixCtx.imageSmoothingEnabled = true
        pixCtx.drawImage(canvas, bx, by, bw, bh, 0, 0, tW, tH)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(pixCanvas, 0, 0, tW, tH, bx, by, bw, bh)
        ctx.imageSmoothingEnabled = true
      }
    }

    /**
     * Draw the watermark image at the configured position / scale / opacity,
     * using the same layout logic as wmPreviewStyle in VideoPreview.
     */
    function drawWatermarkImage() {
      if (!wmImage || !watermark) return
      const { position, opacity, scale, margin } = watermark
      const m = Math.max(4, Math.round(margin * vh / 720))

      const wmW    = vw * scale / 100
      const aspect = wmImage.naturalHeight / (wmImage.naturalWidth || 1)
      const wmH    = Math.min(wmW * aspect, vh * 0.4)
      const actualW = aspect > 0 ? wmH / aspect : wmW

      let x = m
      let y = m
      switch (position) {
        case 'top-right':    x = vw - actualW - m; y = m;              break
        case 'bottom-left':  x = m;                y = vh - wmH - m;   break
        case 'bottom-right': x = vw - actualW - m; y = vh - wmH - m;   break
        case 'center':       x = (vw - actualW) / 2; y = (vh - wmH) / 2; break
        default: break // 'top-left'
      }

      ctx.save()
      ctx.globalAlpha = opacity
      ctx.drawImage(wmImage, x, y, actualW, wmH)
      ctx.restore()
    }

    // ── Main export loop ────────────────────────────────────────────────
    video.onloadeddata = () => {
      const totalDuration  = video.duration
      const clipStart      = Math.max(0, trimStart)
      const clipEnd        = trimEnd !== null ? Math.min(trimEnd, totalDuration) : totalDuration
      const clipDuration   = Math.max(0.1, clipEnd - clipStart)

      let finished  = false
      let isSeeking = false

      function finishExport() {
        if (finished) return
        finished = true
        onProgress?.(1)
        video.pause()
        const audioEl = (video as AudioVideoEl)._audioEl
        if (audioEl) { audioEl.pause(); audioEl.src = ''; audioEl.load() }
        setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop()
          video.src = ''
          video.load()
        }, 350)
      }

      video.onseeked = () => {
        video.onseeked = null
        recorder.start(100)

        const audioEl = (video as AudioVideoEl)._audioEl
        if (audioEl) { audioEl.currentTime = clipStart; audioEl.play().catch(() => {}) }

        let lastProgress = 0

        function renderFrame() {
          if (finished) return
          const currentTime = video.currentTime

          // Stop when we've reached trim end
          if (currentTime >= clipEnd || video.ended) {
            finishExport()
            return
          }

          // Skip over cut/silence ranges (manual cuts + silence removal)
          if (!isSeeking && skipRanges.length > 0) {
            const hit = skipRanges.find(([s, e]) => currentTime >= s && currentTime < e)
            if (hit) {
              const skipTo = Math.min(hit[1], clipEnd)
              isSeeking = true
              video.onseeked = () => {
                video.onseeked = null
                // Re-sync audio to the new position
                if (audioEl) audioEl.currentTime = skipTo
                isSeeking = false
                requestAnimationFrame(renderFrame)
              }
              video.currentTime = skipTo
              return
            }
          }

          // ── Render composite layers ──────────────────────────────────
          drawVideoFrame()       // 1. raw video frame (fit or fill)
          drawBlurRegions()      // 2. pixelation blocks over blur regions
          drawWatermarkImage()   // 3. watermark logo

          // 4. captions
          const activeCaption = getActiveCaption(captionGroups, currentTime)
          if (activeCaption) {
            const word         = activeCaption.group.words[activeCaption.activeWordIndex]
            const wordDuration = word ? (word.endTime - word.startTime) : 0.5
            const wordStart    = word?.startTime ?? 0
            const animProgress = wordDuration > 0
              ? Math.min(1, (currentTime - wordStart) / wordDuration)
              : 0
            drawCaptions(ctx, vw, vh, activeCaption, scaledStyle, animProgress)
          }

          // Report progress
          const progress = clipDuration > 0
            ? Math.min(1, (currentTime - clipStart) / clipDuration)
            : 0
          if (progress - lastProgress > 0.005) {
            lastProgress = progress
            onProgress?.(progress)
          }

          requestAnimationFrame(renderFrame)
        }

        video.play().then(() => {
          requestAnimationFrame(renderFrame)
        }).catch(reject)

        video.onended = finishExport
      }

      // Seek to trim start point to begin export
      video.currentTime = clipStart
    }

    video.onerror = () => reject(new Error('Failed to load video for export'))
  })
}
