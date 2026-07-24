/**
 * Canvas Composite Exporter
 *
 * Draws video frames + captions onto an offscreen canvas, captured via MediaRecorder.
 * Audio is pulled from the original video element's src using a separate Audio element
 * routed through Web Audio API, avoiding InvalidStateError from double-connecting.
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
import { stripMetadataFromWebm } from './ffmpeg'
import { LOUDNESS_PRESETS, type LoudnessTarget } from './loudness'

interface ExportOptions {
  videoElement:    HTMLVideoElement
  captionGroups:   CaptionGroup[]
  captionStyle:    CaptionStyle
  onProgress?:     (progress: number) => void
  targetWidth?:    number | null
  targetHeight?:   number | null
  trimStart?:      number
  trimEnd?:        number | null
  cropMode?:       CropMode
  blurRegions?:    BlurRegion[]
  watermark?:      WatermarkConfig | null
  manualCuts?:     SilenceSegment[]
  silenceSegs?:    SilenceSegment[]
  removeSilence?:  boolean
  loudnessTarget?: LoudnessTarget
  denoiseAudio?:   boolean
  hasAudio?:       boolean
  stripMetadata?:  boolean
  onPhase?:        (label: string) => void
}

// ── Audio chain types and builder ────────────────────────────────────────

interface AudioBundle {
  ctx:     AudioContext
  source:  MediaElementAudioSourceNode
  audioEl: HTMLAudioElement
  dest:    MediaStreamAudioDestinationNode
}

/**
 * Builds the Web Audio processing chain for export.
 *
 * When denoise=true, loads the spectral subtraction AudioWorklet processor
 * (/denoise-processor.js). The worklet applies minimum-statistics noise floor
 * tracking and per-bin spectral subtraction, removing broadband noise (fans,
 * AC hum, room noise) across all frequencies including the speech band.
 *
 * When loudnessTarget is set, applies a DynamicsCompressor and fixed-gain
 * normalization approximating the chosen LUFS target.
 *
 * Called before the export Promise so AudioWorklet.addModule() can be awaited.
 */
async function buildAudioChain(
  src:            string,
  denoise:        boolean,
  loudnessTarget: LoudnessTarget,
): Promise<AudioBundle> {
  const audioEl = new Audio()
  audioEl.src   = src
  audioEl.muted = false
  // Explicit load() so the browser starts buffering immediately.
  // Safari does not begin loading when src is set on a newly created Audio
  // element without an explicit call; this ensures createMediaElementSource
  // below receives a valid, loading element on all browsers.
  audioEl.load()

  const ctx    = new AudioContext()
  try {
    const source = ctx.createMediaElementSource(audioEl)
    const dest   = ctx.createMediaStreamDestination()

    let last: AudioNode = source

    if (denoise) {
      try {
        // Spectral subtraction processor: FFT_SIZE=512, HOP_SIZE=128, 4x overlap.
        // Tracks the noise floor via per-bin running minimum over ~260 ms and
        // subtracts it from each frame, suppressing continuous background noise.
        await ctx.audioWorklet.addModule('/denoise-processor.js')
        const denoiseNode = new AudioWorkletNode(ctx, 'calmclip-denoise')
        last.connect(denoiseNode)
        last = denoiseNode
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Audio denoise setup failed: ${message}`)
      }
    }

    if (loudnessTarget !== 'off') {
      // Dynamics compressor for peak control before the gain stage
      const compressor = ctx.createDynamicsCompressor()
      compressor.threshold.value = -24
      compressor.knee.value      = 10
      compressor.ratio.value     = 8
      compressor.attack.value    = 0.003
      compressor.release.value   = 0.25
      last.connect(compressor)
      last = compressor

      // Fixed-gain loudness approximation: assumes source is -18 LUFS (typical speech)
      // and applies the gain delta to reach the chosen preset. This is a one-pass
      // approximation; the FFmpeg loudnorm path provides a more accurate measurement.
      const gainNode = ctx.createGain()
      const sourceLufs = -18
      const preset     = LOUDNESS_PRESETS.find(p => p.key === loudnessTarget)
      const gainDb     = preset ? (preset.lufs - sourceLufs) : 0
      gainNode.gain.value = Math.pow(10, gainDb / 20)
      last.connect(gainNode)
      last = gainNode
    }

    last.connect(dest)
    return { ctx, source, audioEl, dest }
  } catch (error) {
    try { await ctx.close() } catch { /* cleanup is best effort */ }
    audioEl.pause()
    audioEl.src = ''
    audioEl.load()
    throw error
  }
}

export async function exportVideoWithCaptions({
  videoElement,
  captionGroups,
  captionStyle,
  onProgress,
  targetWidth    = null,
  targetHeight   = null,
  trimStart      = 0,
  trimEnd        = null,
  cropMode       = 'fit',
  blurRegions    = [],
  watermark      = null,
  manualCuts     = [],
  silenceSegs    = [],
  removeSilence  = false,
  loudnessTarget = 'off',
  denoiseAudio   = false,
  hasAudio       = true,
  stripMetadata  = true,
  onPhase,
}: ExportOptions): Promise<Blob> {

  if (videoElement.videoWidth === 0 && videoElement.videoHeight === 0) {
    throw new Error(
      'This file has no video track. Video export is not available for audio-only files. Use the transcript panel to download your transcript as TXT, SRT, or VTT.'
    )
  }
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
    throw new Error('This browser does not support canvas video export. Use a current browser with MediaRecorder and canvas capture support.')
  }
  if (!Number.isFinite(trimStart) || trimStart < 0) {
    throw new Error('The export start time is invalid. Adjust the trim range and retry.')
  }
  if (trimEnd !== null && (!Number.isFinite(trimEnd) || trimEnd <= trimStart)) {
    throw new Error('The export trim range is invalid. Choose an end time after the start time.')
  }
  if (targetWidth !== null && targetWidth !== undefined && (!Number.isInteger(targetWidth) || targetWidth <= 0)) {
    throw new Error('The export width is invalid. Choose a supported output ratio.')
  }
  if (targetHeight !== null && targetHeight !== undefined && (!Number.isInteger(targetHeight) || targetHeight <= 0)) {
    throw new Error('The export height is invalid. Choose a supported output ratio.')
  }

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
    if (!wmImage) {
      throw new Error('The watermark image could not be loaded. Choose a supported image file and retry.')
    }
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

  // Build the audio processing chain before the Promise so AudioWorklet.addModule()
  // can be awaited. Audio setup errors must remain visible to the user.
  let audioBundle: AudioBundle | null = null
  onPhase?.('Preparing audio...')
  if (hasAudio) {
    audioBundle = await buildAudioChain(videoElement.src, denoiseAudio, loudnessTarget)
  }

  // Signal the UI now so the phase label reads "Rendering video..." rather than
  // staying at "Preparing audio..." for the entire duration of the encode.
  // This must be called before the Promise constructor so the label updates
  // synchronously in the same microtask as the caller's await.
  onPhase?.('Rendering video...')

  return new Promise((resolve, reject) => {
    // Use a fresh video clone for frame rendering.
    // Do NOT set crossOrigin: the src is a blob URL (same-origin) and crossOrigin
    // causes the browser to issue a CORS request that blob URLs cannot satisfy.
    const video = document.createElement('video')
    video.src       = videoElement.src
    video.muted     = true
    video.playsInline = true
    // Explicit load() so the browser starts buffering the clone immediately.
    // Firefox and some mobile browsers do not begin loading a programmatically
    // created video element when only src is set; without load(), onloadeddata
    // may never fire and the export Promise would hang indefinitely.
    video.load()

    const vw = targetWidth  || videoElement.videoWidth  || 1280
    const vh = targetHeight || videoElement.videoHeight || 720

    const canvas = document.createElement('canvas')
    canvas.width  = vw
    canvas.height = vh
    const ctx = canvas.getContext('2d')!

    // Pre-created pixel canvas for blur (avoid per-frame allocation)
    const pixCanvas = document.createElement('canvas')
    const pixCtx    = pixCanvas.getContext('2d')!

    // Scale caption style to canvas resolution (1080p baseline).
    // strokeWidth uses Math.max(1, ...) when the original is non-zero so that
    // a configured stroke is never silently dropped by rounding on small exports
    // (e.g. 360p where scaleFactor ~= 0.33 rounds strokeWidth=1 down to 0).
    const scaleFactor = vh / 1080
    const scaledStyle = {
      ...captionStyle,
      fontSize:    Math.round(captionStyle.fontSize    * scaleFactor),
      strokeWidth: captionStyle.strokeWidth > 0
        ? Math.max(1, Math.round(captionStyle.strokeWidth * scaleFactor))
        : 0,
      shadowBlur:  Math.round(captionStyle.shadowBlur  * scaleFactor),
      bgRadius:    Math.round(captionStyle.bgRadius     * scaleFactor),
    }

    const canvasStream = canvas.captureStream(30)

    // Add pre-built audio tracks to the canvas capture stream.
    if (audioBundle) {
      audioBundle.dest.stream.getAudioTracks().forEach(t => canvasStream.addTrack(t))
    }

    // ── MediaRecorder ───────────────────────────────────────────────────
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : MediaRecorder.isTypeSupported('video/webm')
            ? 'video/webm'
            : ''
    if (!mimeType) {
      canvasStream.getTracks().forEach(track => track.stop())
      if (audioBundle) {
        try { audioBundle.source.disconnect() } catch { /* best effort */ }
        void audioBundle.ctx.close()
        audioBundle.audioEl.pause()
        audioBundle.audioEl.src = ''
        audioBundle.audioEl.load()
      }
      throw new Error('This browser cannot encode WebM video. Use a current browser with MediaRecorder support.')
    }

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 8_000_000,
      })
    } catch (error) {
      canvasStream.getTracks().forEach(track => track.stop())
      if (audioBundle) {
        try { audioBundle.source.disconnect() } catch { /* best effort */ }
        void audioBundle.ctx.close()
        audioBundle.audioEl.pause()
        audioBundle.audioEl.src = ''
        audioBundle.audioEl.load()
      }
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Video recorder setup failed: ${message}`)
    }

    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

    let settled          = false
    let stopTimer:        ReturnType<typeof setTimeout> | null = null
    // Cleared when onloadeddata fires; fires failExport if the cloned video
    // element never loads (e.g. partially-corrupt first segment, browser refusal
    // to buffer a second element concurrently, network interruption mid-session).
    let loadedDataTimer: ReturnType<typeof setTimeout> | null = null

    function cleanup(): void {
      if (stopTimer !== null) {
        clearTimeout(stopTimer)
        stopTimer = null
      }
      if (loadedDataTimer !== null) {
        clearTimeout(loadedDataTimer)
        loadedDataTimer = null
      }
      video.onloadeddata = null
      video.onseeked = null
      video.onended = null
      video.onerror = null
      video.pause()
      video.src = ''
      video.load()
      canvasStream.getTracks().forEach(track => track.stop())
      if (audioBundle) {
        try { audioBundle.source.disconnect() } catch { /* cleanup is best effort */ }
        try { void audioBundle.ctx.close() } catch { /* cleanup is best effort */ }
        audioBundle.audioEl.pause()
        audioBundle.audioEl.src = ''
        audioBundle.audioEl.load()
      }
    }

    recorder.onstop = () => {
      if (settled) return
      settled = true
      cleanup()
      const recorded = new Blob(chunks, { type: mimeType })
      if (recorded.size === 0) {
        reject(new Error('The video recorder produced an empty file. Try a shorter clip or a lower output resolution.'))
        return
      }
      onPhase?.(stripMetadata ? 'Removing metadata...' : 'Finalizing video...')
      const finalized = stripMetadata
        ? stripMetadataFromWebm(recorded)
        : Promise.resolve(recorded)
      finalized.then(blob => {
        if (blob.size === 0) {
          throw new Error('The finalized export is empty. The video cannot be downloaded safely.')
        }
        resolve(blob)
      }).catch(error => {
        reject(error instanceof Error ? error : new Error(String(error)))
      })
    }

    recorder.onerror = (e) => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(
        'MediaRecorder error: ' +
        ((e as Event & { error?: { message?: string } }).error?.message || 'unknown')
      ))
    }

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
     * Coordinates are 0 to 100% of the output canvas (top-left origin),
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
        // smoothing, producing a pixelation/mosaic blur effect.
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

    function failExport(error: unknown): void {
      if (settled) return
      settled = true
      cleanup()
      if (recorder.state !== 'inactive') {
        try { recorder.stop() } catch { /* recorder is already failing */ }
      }
      reject(error instanceof Error ? error : new Error(String(error)))
    }

    // ── Main export loop ────────────────────────────────────────────────
    // Safety net: if the cloned video never fires onloadeddata (e.g. the blob
    // URL was revoked while loading, the browser throttles a second concurrent
    // video element, or the first segment of the container is corrupt), the
    // export Promise would be permanently pending with no way to cancel it.
    // After 30 s we reject so the user sees an actionable error instead of an
    // infinite spinner. 30 s is conservative: typical blob-URL load times for
    // files already in the browser are under 200 ms.
    loadedDataTimer = setTimeout(() => {
      failExport(new Error(
        'The video took too long to load for export. ' +
        'Check that the file is still accessible and try again.'
      ))
    }, 30_000)

    video.onloadeddata = () => {
      // Cancel the safety-net timer as soon as the video is ready.
      if (loadedDataTimer !== null) { clearTimeout(loadedDataTimer); loadedDataTimer = null }
      const totalDuration  = video.duration
      const clipStart      = Math.max(0, trimStart)
      const clipEnd        = trimEnd !== null ? Math.min(trimEnd, totalDuration) : totalDuration
      const clipDuration   = Math.max(0.1, clipEnd - clipStart)

      let finished  = false
      let isSeeking = false

      function finishExport() {
        if (finished || settled) return
        finished = true
        // 0.98 rather than 1: the remaining 2% is covered by the metadata-strip
        // phase so the progress bar does not read 100% while "Removing metadata..."
        // is still running. ExportPanel shows the done state only after resolve().
        onProgress?.(0.98)
        video.pause()
        if (audioBundle) { audioBundle.audioEl.pause() }
        stopTimer = setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop()
        }, 350)
      }

      video.onseeked = () => {
        video.onseeked = null
        try {
          recorder.start(100)
        } catch (error) {
          failExport(error)
          return
        }

        if (audioBundle) {
          audioBundle.audioEl.currentTime = clipStart
          audioBundle.ctx.resume()
            .then(() => audioBundle!.audioEl.play())
            .catch(failExport)
        }

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
                // Re-sync audio to the new video position
                if (audioBundle) audioBundle.audioEl.currentTime = skipTo
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
        }).catch(failExport)

        video.onended = finishExport
      }

      // Seek to trim start point to begin export
      video.currentTime = clipStart
    }

    video.onerror = () => failExport(new Error('Failed to load video for export. The source may use an unsupported codec.'))
  })
}
