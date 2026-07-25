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
import { LOUDNESS_PRESETS, type LoudnessTarget } from './loudness'

// ─── JavaScript-based WebM finalizer ────────────────────────────────────────
//
// MediaRecorder WebM output is often playable but has no SegmentInfo Duration.
// Some players, including VLC, then display a total duration of 00:00. This
// finalizer repairs the EBML container directly, without FFmpeg remuxing. It
// also clears the identifying fields that can be emitted by MediaRecorder.
//
// FFmpeg remuxing is intentionally not used here. The multi-threaded WASM core
// can abort after exec, while the single-threaded core can truncate canvas
// output when Web Audio and video timestamps do not start at the same origin.

const WEBM_META_IDS = new Set([0x4D80, 0x5741, 0x7BA9, 0x4461])
const EBML_ID_HEADER    = 0x1A45DFA3
const EBML_ID_SEGMENT   = 0x18538067
const EBML_ID_SEG_INFO  = 0x1549A966
const EBML_ID_SEEK_HEAD = 0x114D9B74
const EBML_ID_TRACKS    = 0x1654AE6B
const EBML_ID_DURATION  = 0x4489
const EBML_ID_TIME_SCALE = 0x2AD7B1
const EBML_ID_SEEK      = 0x4DBB
const EBML_ID_SEEK_ID   = 0x53AB
const EBML_ID_SEEK_POS  = 0x53AC
const UNKNOWN_SIZE = -1

interface EbmlSize {
  size: number
  n: number
}

interface EbmlElement {
  id: number
  start: number
  dataStart: number
  end: number
  size: number
  sizeN: number
}

function ebmlReadId(a: Uint8Array, p: number): { id: number; n: number } | null {
  if (p >= a.length) return null
  const b = a[p]
  const n = b >= 0x80 ? 1 : b >= 0x40 ? 2 : b >= 0x20 ? 3 : b >= 0x10 ? 4 : 0
  if (n === 0 || p + n > a.length) return null
  let id = 0
  for (let i = 0; i < n; i++) id = id * 256 + a[p + i]
  return { id, n }
}

function ebmlReadSize(a: Uint8Array, p: number): EbmlSize | null {
  if (p >= a.length) return null
  const b = a[p]
  let n: number
  let mask: number
  if      (b >= 0x80) { n = 1; mask = 0x7F }
  else if (b >= 0x40) { n = 2; mask = 0x3F }
  else if (b >= 0x20) { n = 3; mask = 0x1F }
  else if (b >= 0x10) { n = 4; mask = 0x0F }
  else if (b >= 0x08) { n = 5; mask = 0x07 }
  else if (b >= 0x04) { n = 6; mask = 0x03 }
  else if (b >= 0x02) { n = 7; mask = 0x01 }
  else                { n = 8; mask = 0x00 }
  if (p + n > a.length) return null
  let allSet = (b & mask) === mask
  let size = b & mask
  for (let i = 1; i < n; i++) {
    allSet = allSet && a[p + i] === 0xFF
    size = size * 256 + a[p + i]
  }
  return { size: allSet ? UNKNOWN_SIZE : size, n }
}

function ebmlElement(a: Uint8Array, start: number, limit: number): EbmlElement | null {
  const id = ebmlReadId(a, start)
  if (!id) return null
  const size = ebmlReadSize(a, start + id.n)
  if (!size) return null
  const dataStart = start + id.n + size.n
  if (size.size === UNKNOWN_SIZE) return {
    id: readEbmlIdValue(a, start, id.n),
    start,
    dataStart,
    end: limit,
    size: UNKNOWN_SIZE,
    sizeN: size.n,
  }
  const end = dataStart + size.size
  if (end > limit) return null
  return { id: readEbmlIdValue(a, start, id.n), start, dataStart, end, size: size.size, sizeN: size.n }
}

function readEbmlIdValue(a: Uint8Array, start: number, width: number): number {
  let id = 0
  for (let i = 0; i < width; i++) id = id * 256 + a[start + i]
  return id
}

function readEbmlUnsigned(a: Uint8Array, start: number, size: number): number {
  if (size < 1 || size > 8 || start + size > a.length) {
    throw new Error('The WebM timestamp scale is invalid.')
  }
  let value = 0
  for (let i = 0; i < size; i++) value = value * 256 + a[start + i]
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('The WebM timestamp scale is outside the supported range.')
  }
  return value
}

function ebmlSizeWidth(size: number, preferredWidth?: number): number {
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error('The finalized WebM container is too large to encode safely.')
  }
  const fits = (width: number) => {
    const max = 2 ** (7 * width) - 2
    return size <= max
  }
  if (preferredWidth !== undefined && preferredWidth >= 1 && preferredWidth <= 8 && fits(preferredWidth)) {
    return preferredWidth
  }
  for (let width = 1; width <= 8; width++) {
    if (fits(width)) return width
  }
  throw new Error('The finalized WebM container is too large to encode safely.')
}

function ebmlEncodeSize(size: number, preferredWidth?: number): Uint8Array {
  const width = ebmlSizeWidth(size, preferredWidth)
  const out = new Uint8Array(width)
  let remaining = size
  for (let i = width - 1; i >= 0; i--) {
    out[i] = remaining & 0xFF
    remaining = Math.floor(remaining / 256)
  }
  out[0] |= 1 << (8 - width)
  return out
}

function ebmlEncodeElement(id: number, payload: Uint8Array, preferredSizeWidth?: number): Uint8Array {
  const idBytes = id <= 0xFF
    ? [id]
    : id <= 0xFFFF
      ? [id >> 8, id & 0xFF]
      : id <= 0xFFFFFF
        ? [id >> 16, (id >> 8) & 0xFF, id & 0xFF]
        : [(id >>> 24) & 0xFF, (id >>> 16) & 0xFF, (id >>> 8) & 0xFF, id & 0xFF]
  const sizeBytes = ebmlEncodeSize(payload.length, preferredSizeWidth)
  const out = new Uint8Array(idBytes.length + sizeBytes.length + payload.length)
  out.set(idBytes, 0)
  out.set(sizeBytes, idBytes.length)
  out.set(payload, idBytes.length + sizeBytes.length)
  return out
}

function ebmlConcat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function writeFloat(a: Uint8Array, start: number, size: number, value: number): void {
  const view = new DataView(a.buffer, a.byteOffset + start, size)
  if (size === 4) view.setFloat32(0, value, false)
  else if (size === 8) view.setFloat64(0, value, false)
  else throw new Error('The WebM Duration element has an unsupported size.')
}

function writeUnsigned(a: Uint8Array, start: number, size: number, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value >= 2 ** (8 * size)) {
    throw new Error('The WebM seek index is outside the supported range.')
  }
  let remaining = value
  for (let i = start + size - 1; i >= start; i--) {
    a[i] = remaining & 0xFF
    remaining = Math.floor(remaining / 256)
  }
}

function durationPayload(durationSec: number, timestampScale: number, bytes: 4 | 8): Uint8Array {
  const ticks = durationSec * 1_000_000_000 / timestampScale
  if (!Number.isFinite(ticks) || ticks <= 0) {
    throw new Error('The export duration cannot be represented in the WebM container.')
  }
  const payload = new Uint8Array(bytes)
  writeFloat(payload, 0, bytes, ticks)
  return payload
}

function createDurationElement(durationSec: number, timestampScale: number, bytes: 4 | 8): Uint8Array {
  return ebmlEncodeElement(EBML_ID_DURATION, durationPayload(durationSec, timestampScale, bytes), 1)
}

function updateSeekPositions(
  a: Uint8Array,
  seekHead: EbmlElement,
  oldInfoEndRelative: number,
  delta: number,
): void {
  let p = seekHead.dataStart
  while (p < seekHead.end) {
    const seek = ebmlElement(a, p, seekHead.end)
    if (!seek || seek.size === UNKNOWN_SIZE) throw new Error('The WebM seek index is invalid.')
    if (seek.id === EBML_ID_SEEK) {
      let seekId: Uint8Array | null = null
      let seekPosition: EbmlElement | null = null
      let child = seek.dataStart
      while (child < seek.end) {
        const entry = ebmlElement(a, child, seek.end)
        if (!entry || entry.size === UNKNOWN_SIZE) throw new Error('The WebM seek entry is invalid.')
        if (entry.id === EBML_ID_SEEK_ID) seekId = a.slice(entry.dataStart, entry.end)
        if (entry.id === EBML_ID_SEEK_POS) seekPosition = entry
        child = entry.end
      }
      if (seekId && seekPosition && readEbmlIdValue(seekId, 0, seekId.length) !== EBML_ID_SEG_INFO) {
        const position = readEbmlUnsigned(a, seekPosition.dataStart, seekPosition.size)
        if (position >= oldInfoEndRelative) {
          writeUnsigned(a, seekPosition.dataStart, seekPosition.size, position + delta)
        }
      }
    }
    p = seek.end
  }
}

function effectiveDuration(
  clipStart: number,
  clipEnd: number,
  skipRanges: [number, number][],
): number {
  const ranges = skipRanges
    .map(([start, end]) => [
      Math.max(clipStart, Math.min(clipEnd, start)),
      Math.max(clipStart, Math.min(clipEnd, end)),
    ] as [number, number])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0])

  let skipped = 0
  let current: [number, number] | null = null
  for (const range of ranges) {
    if (!current || range[0] > current[1]) {
      if (current) skipped += current[1] - current[0]
      current = range
    } else {
      current[1] = Math.max(current[1], range[1])
    }
  }
  if (current) skipped += current[1] - current[0]
  return Math.max(0, clipEnd - clipStart - skipped)
}

function rewriteWebm(
  source: Uint8Array,
  durationSec: number,
  sanitizeMetadata: boolean,
): Uint8Array {
  if (source.length < 4) throw new Error('The exported WebM file is incomplete.')
  const header = ebmlElement(source, 0, source.length)
  if (!header || header.id !== EBML_ID_HEADER || header.size === UNKNOWN_SIZE) {
    throw new Error('The exported WebM file has an invalid EBML header.')
  }
  const segment = ebmlElement(source, header.end, source.length)
  if (!segment || segment.id !== EBML_ID_SEGMENT) {
    throw new Error('The exported WebM file has no valid Segment element.')
  }
  const segmentContentEnd = segment.size === UNKNOWN_SIZE ? source.length : segment.end
  let info: EbmlElement | null = null
  let seekHead: EbmlElement | null = null
  let p = segment.dataStart
  while (p < segmentContentEnd) {
    const element = ebmlElement(source, p, segmentContentEnd)
    if (!element || element.size === UNKNOWN_SIZE) {
      throw new Error('The exported WebM container has an invalid top-level element.')
    }
    if (element.id === EBML_ID_SEG_INFO) {
      info = element
      break
    }
    if (element.id === EBML_ID_SEEK_HEAD) seekHead = element
    if (element.id === EBML_ID_TRACKS) break
    p = element.end
  }
  if (!info) throw new Error('The exported WebM file has no SegmentInfo element.')

  let timestampScale = 1_000_000
  let durationElement: EbmlElement | null = null
  const metadataElements: EbmlElement[] = []
  p = info.dataStart
  while (p < info.end) {
    const element = ebmlElement(source, p, info.end)
    if (!element || element.size === UNKNOWN_SIZE) {
      throw new Error('The exported WebM SegmentInfo is invalid.')
    }
    if (element.id === EBML_ID_TIME_SCALE) {
      timestampScale = readEbmlUnsigned(source, element.dataStart, element.size)
    } else if (element.id === EBML_ID_DURATION) {
      durationElement = element
    } else if (WEBM_META_IDS.has(element.id)) {
      metadataElements.push(element)
    }
    p = element.end
  }

  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error('The export duration is not available, so the WebM file cannot be finalized safely.')
  }

  const durationTicks = durationSec * 1_000_000_000 / timestampScale
  if (!Number.isFinite(durationTicks) || durationTicks <= 0) {
    throw new Error('The export duration is outside the supported WebM range.')
  }

  if (sanitizeMetadata) {
    for (const element of metadataElements) {
      source.fill(0, element.dataStart, element.end)
    }
  }

  if (durationElement && (durationElement.size === 4 || durationElement.size === 8)) {
    writeFloat(source, durationElement.dataStart, durationElement.size, durationTicks)
    return source
  }
  if (durationElement) {
    throw new Error('The existing WebM Duration element has an unsupported size.')
  }

  const duration = createDurationElement(durationSec, timestampScale, 8)
  const infoPayload = source.slice(info.dataStart, info.end)
  const newInfoPayload = ebmlConcat([infoPayload, duration])
  const newInfo = ebmlEncodeElement(EBML_ID_SEG_INFO, newInfoPayload, info.sizeN)
  const delta = newInfo.length - (info.end - info.start)
  const segmentSize = segment.size === UNKNOWN_SIZE
    ? null
    : ebmlEncodeSize(segment.size + delta, segment.sizeN)
  const newSegmentHeader = segment.size === UNKNOWN_SIZE
    ? source.slice(segment.start, segment.dataStart)
    : ebmlConcat([
        source.slice(segment.start, segment.start + 4),
        segmentSize!,
      ])
  const output = ebmlConcat([
    source.slice(0, segment.start),
    newSegmentHeader,
    source.slice(segment.dataStart, info.start),
    newInfo,
    source.slice(info.end),
  ])

  const segmentHeaderDelta = newSegmentHeader.length - (segment.dataStart - segment.start)
  if (seekHead && delta !== 0) {
    const seekHeadStart = seekHead.start + segmentHeaderDelta +
      (seekHead.start >= info.end ? delta : 0)
    const newSeekHead = ebmlElement(output, seekHeadStart, output.length)
    if (!newSeekHead) throw new Error('The finalized WebM seek index could not be located.')
    updateSeekPositions(
      output,
      newSeekHead,
      info.end - segment.dataStart,
      delta,
    )
  }

  return output
}

// Finalizes a WebM blob in the browser. When sanitizeMetadata is false, the
// duration is still repaired while private metadata is left unchanged.
export async function stripWebmMetadata(
  blob: Blob,
  durationSec: number,
  sanitizeMetadata = true,
): Promise<Blob> {
  const source = new Uint8Array(await blob.arrayBuffer())
  const output = rewriteWebm(source, durationSec, sanitizeMetadata)
  if (output.byteLength === 0) {
    throw new Error('WebM finalization produced an empty video. The export cannot be downloaded safely.')
  }
  return new Blob([output.buffer as ArrayBuffer], { type: blob.type || 'video/webm' })
}

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

  console.log('[CalmClip] canvasExport: start',
    `trimStart=${trimStart.toFixed(3)}s trimEnd=${trimEnd?.toFixed(3) ?? 'null'}`,
    `res=${targetWidth ?? 'src'}x${targetHeight ?? 'src'}`,
    `hasAudio=${hasAudio} stripMetadata=${stripMetadata}`,
    `skipRanges=${skipRanges.length} denoise=${denoiseAudio} loudness=${loudnessTarget}`)

  // Log caption burn-in summary so it is immediately visible in the console
  // whether the export is carrying captions at all. Without this, "no captions
  // in my export" is indistinguishable from "captions were never passed to the
  // exporter" vs "captions were passed but getActiveCaption never matched".
  if (captionGroups.length === 0) {
    console.log('[CalmClip] canvasExport: captions=none (no groups passed -- video will export without burned-in captions)')
  } else {
    const totalWords = captionGroups.reduce((n, g) => n + g.words.length, 0)
    const firstT     = captionGroups[0].startTime
    const lastT      = captionGroups[captionGroups.length - 1].endTime
    console.log(
      `[CalmClip] canvasExport: captions=${captionGroups.length} groups`,
      `${totalWords} words`,
      `span=[${firstT.toFixed(3)}s, ${lastT.toFixed(3)}s]`,
    )
  }

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
    console.log('[CalmClip] canvasExport: MediaRecorder mimeType=' + (mimeType || '(none supported)'),
      `canvas=${vw}x${vh} audioTracks=${audioBundle ? audioBundle.dest.stream.getAudioTracks().length : 0}`)
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
    // Set in onloadeddata once clipStart, clipEnd and skipRanges are all known.
    // Used by recorder.onstop to write the correct Duration element into the WebM.
    // effectiveDuration subtracts every silence/manual-cut range that falls inside
    // the clip, so the Duration in the container matches what the viewer actually
    // sees rather than the raw clip length.
    let exportDurationSec = 0

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
      console.log('[CalmClip] canvasExport: recorder stopped,',
        `chunks=${chunks.length} recorded=${recorded.size}B (${(recorded.size / 1_048_576).toFixed(2)} MB)`)
      if (recorded.size === 0) {
        reject(new Error('The video recorder produced an empty file. Try a shorter clip or a lower output resolution.'))
        return
      }
      onPhase?.(stripMetadata ? 'Removing metadata...' : 'Finalizing video...')
      // Always call stripWebmMetadata regardless of the stripMetadata flag.
      // The third parameter controls whether identifying fields (MuxingApp,
      // WritingApp, etc.) are cleared; the Duration element is always written
      // so that players can display the correct total length. Without this,
      // players that cannot determine duration from the container (e.g. VLC
      // playing a streaming WebM with unknown Segment size) show 0:00 remaining
      // for the entire playback.
      const finalized = stripWebmMetadata(recorded, exportDurationSec, stripMetadata)
      finalized.then(blob => {
        if (blob.size === 0) {
          throw new Error('The finalized export is empty. The video cannot be downloaded safely.')
        }
        resolve(blob)
      }).catch(error => {
        console.error('[CalmClip] canvasExport: finalization error:', error)
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
      // Compute the true output duration now that clipStart, clipEnd and skipRanges
      // are all known. This value is written into the WebM Duration element by
      // recorder.onstop so that players can display the correct total length.
      exportDurationSec = effectiveDuration(clipStart, clipEnd, skipRanges)

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
              // When the cut range reaches or passes clipEnd -- or leaves less
              // than one frame of content before it -- there is nothing
              // meaningful left to record. Finish immediately instead of seeking.
              //
              // Why the tolerance? FFmpeg timestamps and browser video.duration
              // are derived from different timebases. For example, FFmpeg may
              // report silence_end=67.9893 while video.duration=67.989333 (the
              // same "end of file" expressed in different precisions). The raw
              // equality check (skipTo >= clipEnd) misses cases like this one
              // where the two values are < 1 ms apart. A 50 ms threshold -- well
              // under one frame at any frame rate -- covers the precision gap
              // without accidentally skipping real content (the silence detector
              // minimum duration is 1 s, and manual cuts are user-placed).
              //
              // Avoiding the seek also eliminates the race between the 'ended'
              // and 'seeked' events that occurs when seeking a video element to
              // or very near video.duration: whichever fires first determines
              // whether isSeeking is still true when finishExport runs, which
              // can leave the recorder in an inconsistent state.
              if (clipEnd - skipTo < 0.05) {
                console.log('[CalmClip] canvasExport: skip range [' +
                  hit[0].toFixed(3) + ', ' + hit[1].toFixed(3) +
                  '] reaches clip end (remaining=' + (clipEnd - skipTo).toFixed(4) +
                  's) -- finishing without seek')
                if (audioBundle) audioBundle.audioEl.pause()
                finishExport()
                return
              }
              console.log('[CalmClip] canvasExport: skip range hit [' +
                hit[0].toFixed(3) + ', ' + hit[1].toFixed(3) + '] -> seekTo=' + skipTo.toFixed(3))
              isSeeking = true
              // Pause the audio element immediately so no content from the
              // skipped region is routed through the Web Audio graph and
              // recorded into the MediaRecorder output during the seek.
              if (audioBundle) audioBundle.audioEl.pause()
              // Pause the MediaRecorder so canvas.captureStream() does not
              // record frozen frames while the browser seeks. Without this,
              // every frame rendered during the seek (which can take several
              // real-time seconds for large jumps on a blob URL) is recorded
              // as a duplicate of the last frame, producing a video freeze in
              // the output for the full seek duration.
              if (recorder.state === 'recording') recorder.pause()
              video.onseeked = () => {
                video.onseeked = null
                // Re-sync audio to the new video position and resume.
                if (audioBundle) {
                  audioBundle.audioEl.currentTime = skipTo
                  audioBundle.audioEl.play().catch(() => {})
                }
                isSeeking = false
                // Resume capturing only after the seek is complete so the
                // recorder picks up clean frames from the new position.
                if (recorder.state === 'paused') recorder.resume()
                requestAnimationFrame(renderFrame)
              }
              video.currentTime = skipTo
              return
            }
          }

          // While a seek is in progress, hold the canvas without drawing:
          // rendering the in-flight seek frame would record a stale or
          // partially-decoded frame from the cut region into the output.
          if (isSeeking) {
            requestAnimationFrame(renderFrame)
            return
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

            // In fit mode the video is letterboxed or pillarboxed within the
            // canvas. Draw captions within the video content rect only, so
            // they never land in the black bars. Fill mode: video covers the
            // full canvas, so use the full dimensions directly.
            if (cropMode === 'fill' || !video.videoWidth || !video.videoHeight) {
              drawCaptions(ctx, vw, vh, activeCaption, scaledStyle, animProgress)
            } else {
              const fitScale = Math.min(vw / video.videoWidth, vh / video.videoHeight)
              const capW = video.videoWidth  * fitScale
              const capH = video.videoHeight * fitScale
              const capX = (vw - capW) / 2
              const capY = (vh - capH) / 2
              // Re-scale style to the video content height, not the full canvas height.
              const fitFactor = capH / 1080
              const fitStyle = {
                ...captionStyle,
                fontSize:    Math.round(captionStyle.fontSize    * fitFactor),
                strokeWidth: captionStyle.strokeWidth > 0
                  ? Math.max(1, Math.round(captionStyle.strokeWidth * fitFactor))
                  : 0,
                shadowBlur:  Math.round(captionStyle.shadowBlur  * fitFactor),
                bgRadius:    Math.round(captionStyle.bgRadius     * fitFactor),
              }
              ctx.save()
              ctx.translate(capX, capY)
              drawCaptions(ctx, capW, capH, activeCaption, fitStyle, animProgress)
              ctx.restore()
            }
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
