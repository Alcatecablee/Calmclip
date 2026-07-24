// webcodecs.ts
// Hardware-accelerated export via the WebCodecs API + mp4box + mp4-muxer.
//
// Tier 3 in the export pipeline (falls back to FFmpeg when not viable):
//   Supported:     trim, scale/crop, watermark, audio (AAC re-encode)
//   Not supported: silence/manual cuts, face blur, WebM output, audio filters
//
// Pipeline:
//   mp4box demuxes the source
//   VideoDecoder decodes H.264 frames
//   OffscreenCanvas composites (scale/crop + watermark)
//   VideoEncoder re-encodes with hardware H.264
//   mp4-muxer writes the final MP4 into an ArrayBuffer

import * as MP4Box from 'mp4box'
import { Muxer, ArrayBufferTarget, type MuxerOptions } from 'mp4-muxer'
import type { ExportOptions, Ratio, OutputQuality, CropMode, WatermarkOpts } from './ffmpeg'

// ─── Dimension tables (mirrors ffmpeg.ts; local copy avoids circular import) ──

const WC_DIMS_720: Record<Ratio, [number, number]> = {
  '16:9': [1280, 720],
  '9:16': [720, 1280],
  '1:1':  [720, 720],
  '4:5':  [720, 900],
}
const WC_DIMS_1080: Record<Ratio, [number, number]> = {
  '16:9': [1920, 1080],
  '9:16': [1080, 1920],
  '1:1':  [1080, 1080],
  '4:5':  [1080, 1350],
}
function wcGetDims(ratio: Ratio, quality: OutputQuality): [number, number] {
  return quality === '1080p' ? WC_DIMS_1080[ratio] : WC_DIMS_720[ratio]
}

// ─── Capability cache + viability checks ─────────────────────────────────────

let _wcCache: boolean | null = null

export async function checkWebCodecsAvailable(): Promise<boolean> {
  if (_wcCache !== null) return _wcCache
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
    _wcCache = false
    return false
  }
  // Test multiple codec profiles and acceleration modes. Some hardware
  // configurations (e.g. integrated Intel GPU via ANGLE/D3D11) return
  // supported:false for the default config even though Chrome's software
  // encoder handles the same codec without any problem.
  const baseConfig = { width: 1280, height: 720, bitrate: 2_000_000, framerate: 30 }
  const codecs = ['avc1.640033', 'avc1.4d001f', 'avc1.42E01E'] as const
  const accel  = ['no-preference', 'prefer-software'] as const
  try {
    for (const codec of codecs) {
      for (const hardwareAcceleration of accel) {
        const { supported } = await VideoEncoder.isConfigSupported({
          ...baseConfig, codec, hardwareAcceleration,
        })
        if (supported === true) {
          _wcCache = true
          return true
        }
      }
    }
    _wcCache = false
    return false
  } catch {
    _wcCache = false
    return false
  }
}

// Probes the source file to determine whether the browser's VideoDecoder
// can handle its video codec. Parses the first 8 MB with mp4box (enough
// to reach the moov atom in most camera-recorded MP4s), then calls
// VideoDecoder.isConfigSupported(). Returns false on any failure or timeout
// so the caller falls through to FFmpeg safely.
export async function checkFileDecodable(file: File): Promise<boolean> {
  if (typeof VideoDecoder === 'undefined') return false
  const SLICE = Math.min(file.size, 8 * 1024 * 1024)

  // Read the slice once; reused for both the codec-info pass and the decode probe.
  let fileBuf: ArrayBuffer
  try {
    fileBuf = await Promise.race([
      file.slice(0, SLICE).arrayBuffer(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ])
  } catch {
    return false
  }

  // ── Phase 1 + 2: codec discovery + isConfigSupported ─────────────────────
  // Determines whether the browser claims to support this codec at all.
  type TrackInfo = { codec: string; width: number; height: number }
  const trackInfo = await Promise.race([
    new Promise<TrackInfo | null>(resolve => {
      const mp4 = MP4Box.createFile()
      mp4.onError = () => resolve(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mp4box info shape
      mp4.onReady = async (info: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mp4box track type
        const vTrack = info.videoTracks?.[0] as any
        const codec  = (vTrack?.codec as string | undefined) ?? ''
        if (!codec) { resolve(null); return }
        try {
          const { supported } = await VideoDecoder.isConfigSupported({
            codec,
            codedWidth:  vTrack.track_width  || vTrack.video?.width  || 1280,
            codedHeight: vTrack.track_height || vTrack.video?.height || 720,
          })
          if (!supported) { resolve(null); return }
          resolve({
            codec,
            width:  vTrack.track_width  || vTrack.video?.width  || 1280,
            height: vTrack.track_height || vTrack.video?.height || 720,
          })
        } catch {
          resolve(null)
        }
      }
      const arr = fileBuf.slice(0) as ArrayBuffer & { fileStart: number }
      arr.fileStart = 0
      mp4.appendBuffer(arr)
      mp4.flush()
    }),
    new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)),
  ])

  if (!trackInfo) return false

  // ── Phase 3: actual decode probe ──────────────────────────────────────────
  // isConfigSupported() only verifies the codec string. Some H.264 streams —
  // particularly screen-recording encoders like "AVC Coding" (Zoom, Loom,
  // Teams) — pass the string check but fail at runtime mid-export with
  // "Decoding error." Decode the first keyframe for real; if the browser's
  // hardware decoder rejects it, return false so the caller falls through to
  // FFmpeg stream copy instead of failing mid-export.
  //
  // NOTE: onReady MUST be synchronous here. appendBuffer() fires onReady
  // synchronously; we must register setExtractionOptions + start() before
  // flush() is called so that mp4box delivers samples to onSamples.
  //
  // probeDone is shared with the timeout branch so the VideoDecoder is always
  // closed when the race settles, preventing hardware decoder slot leaks that
  // would block subsequent export attempts.
  let probeDone: (ok: boolean) => void = (_ok: boolean) => {}
  return Promise.race([
    new Promise<boolean>(resolve => {
      let settled = false
      let probeDecoder: VideoDecoder | null = null

      function done(ok: boolean): void {
        if (settled) return
        settled = true
        try { probeDecoder?.close() } catch { /* ignore */ }
        probeDecoder = null
        resolve(ok)
      }
      probeDone = done

      const mp4probe = MP4Box.createFile()
      mp4probe.onError = () => done(false)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mp4box info shape
      mp4probe.onReady = (info: any) => {
        if (settled) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mp4box track type
        const vTrack = info.videoTracks?.[0] as any
        if (!vTrack) { done(false); return }

        const videoDesc = extractVideoDesc(mp4probe, vTrack.id)
        try {
          probeDecoder = new VideoDecoder({
            output: (frame: VideoFrame) => { frame.close(); done(true)  },
            error:  ()                   => {                done(false) },
          })
          probeDecoder.configure({
            codec:       trackInfo.codec,
            codedWidth:  trackInfo.width,
            codedHeight: trackInfo.height,
            ...(videoDesc ? { description: videoDesc } : {}),
            optimizeForLatency: false,
          })
        } catch {
          done(false); return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mp4box sample shape
        mp4probe.onSamples = (_id: number, _ref: unknown, samples: any[]) => {
          if (settled || samples.length === 0) return
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mp4box sample shape
          const keyframe = samples.find((s: any) => s.is_sync)
          if (!keyframe) return
          mp4probe.stop()
          try {
            probeDecoder!.decode(new EncodedVideoChunk({
              type:      'key',
              timestamp: 0,
              data:      keyframe.data,
            }))
            // flush() resolves after all queued frames are output.
            // If the decoder errored during flush, treat the file as not decodable.
            probeDecoder!.flush().catch(() => done(false))
          } catch {
            done(false)
          }
        }

        mp4probe.setExtractionOptions(vTrack.id, null, { nbSamples: 10 })
        mp4probe.seek(0, true)
        mp4probe.start()
      }

      const arr2 = fileBuf.slice(0) as ArrayBuffer & { fileStart: number }
      arr2.fileStart = 0
      mp4probe.appendBuffer(arr2)
      mp4probe.flush()
    }),
    new Promise<boolean>(resolve => setTimeout(() => { probeDone(false); resolve(false) }, 2000)),
  ])
}

export function isWebCodecsViable(
  opts: Pick<ExportOptions,
    'file' | 'removeSilence' | 'silenceSegments' |
    'manualCuts' | 'blurRegions' | 'outputFormat' | 'denoiseAudio' | 'loudnessTarget'>,
): boolean {
  const ext = opts.file.name.toLowerCase().split('.').pop() ?? ''
  if (!['mp4', 'mov', 'm4v'].includes(ext)) return false
  const hasCuts =
    (opts.removeSilence && opts.silenceSegments.length > 0) ||
    (opts.manualCuts?.length ?? 0) > 0
  if (hasCuts) return false
  if (opts.blurRegions.length > 0) return false
  if ((opts.outputFormat ?? 'mp4') === 'webm') return false
  if (opts.denoiseAudio) return false
  if (opts.loudnessTarget !== 'off') return false
  return true
}

// ─── Scale / crop geometry ────────────────────────────────────────────────────

interface DrawParams {
  sx: number; sy: number; sw: number; sh: number
  dx: number; dy: number; dw: number; dh: number
  needsPad: boolean
}

function computeDrawParams(
  srcW: number, srcH: number,
  outW: number, outH: number,
  cropMode: CropMode,
): DrawParams {
  if (cropMode === 'fill') {
    const scale = Math.max(outW / srcW, outH / srcH)
    const sw = outW / scale, sh = outH / scale
    return {
      sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh,
      dx: 0, dy: 0, dw: outW, dh: outH,
      needsPad: false,
    }
  }
  const scale = Math.min(outW / srcW, outH / srcH)
  const dw = Math.round(srcW * scale), dh = Math.round(srcH * scale)
  return {
    sx: 0, sy: 0, sw: srcW, sh: srcH,
    dx: Math.round((outW - dw) / 2), dy: Math.round((outH - dh) / 2), dw, dh,
    needsPad: true,
  }
}

// ─── mp4box box-tree helpers ──────────────────────────────────────────────────

// Extracts AVCDecoderConfigurationRecord or HEVCDecoderConfigurationRecord bytes
// by serializing the avcC/hvcC box from mp4box's parsed box tree.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mp4box has no typed box-tree API
function extractVideoDesc(mp4File: any, trackId: number): Uint8Array | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- internal mp4box tree
    const entry = mp4File.getTrackById(trackId)?.mdia?.minf?.stbl?.stsd?.entries?.[0] as any
    const box   = entry?.avcC ?? entry?.hvcC
    if (!box) return undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataStream is a bundled mp4box utility
    const DS = (MP4Box as any).DataStream as any
    if (!DS) return undefined
    const ds = new DS(undefined, 0, DS.BIG_ENDIAN)
    box.write(ds)
    return new Uint8Array(ds.buffer, 8)   // skip 4-byte box size + 4-byte box type
  } catch {
    return undefined
  }
}

// Extracts the AudioSpecificConfig from the ESDS box for AAC streams.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mp4box internal ESDS structure
function extractAudioDesc(mp4File: any, trackId: number): Uint8Array | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- internal mp4box tree
    const entry = mp4File.getTrackById(trackId)?.mdia?.minf?.stbl?.stsd?.entries?.[0] as any
    const esds  = entry?.esds ?? entry?.mp4a?.esds
    if (!esds) return undefined
    // Descriptor chain: ES_Descriptor -> DecoderConfigDescriptor -> DecoderSpecificInfo
    const di = esds.contents?.descs?.[0]?.descs?.[0]
    if (!di?.data) return undefined
    if (di.data instanceof Uint8Array)  return di.data
    if (di.data instanceof ArrayBuffer) return new Uint8Array(di.data)
    if (Array.isArray(di.data))         return new Uint8Array(di.data as number[])
    return undefined
  } catch {
    return undefined
  }
}

// ─── Watermark compositing ────────────────────────────────────────────────────

function drawWatermark(
  ctx: OffscreenCanvasRenderingContext2D,
  bm: ImageBitmap,
  wm: WatermarkOpts,
  outW: number,
  outH: number,
): void {
  const wmW = Math.max(10, Math.round(outW * wm.scale / 100))
  const wmH = Math.round(wmW * bm.height / bm.width)
  const m   = Math.round((wm.margin ?? 10) * outH / 720)
  let wx = 0, wy = 0
  switch (wm.position) {
    case 'top-left':     wx = m;               wy = m;                break
    case 'top-right':    wx = outW - wmW - m;  wy = m;                break
    case 'bottom-left':  wx = m;               wy = outH - wmH - m;   break
    case 'bottom-right': wx = outW - wmW - m;  wy = outH - wmH - m;   break
    case 'center':       wx = (outW - wmW) / 2; wy = (outH - wmH) / 2; break
  }
  ctx.save()
  ctx.globalAlpha = wm.opacity
  ctx.drawImage(bm, wx, wy, wmW, wmH)
  ctx.restore()
}

// ─── Main export ──────────────────────────────────────────────────────────────


export async function exportVideoWebCodecs(opts: ExportOptions): Promise<Uint8Array> {
  const {
    file, trimStart, trimEnd, ratio, quality, cropMode = 'fill',
    hasAudio, watermark,
    onProgress, onPhase,
  } = opts

  onPhase?.('Preparing...')

  const [outW, outH] = wcGetDims(ratio, quality)
  // ── Pre-load watermark bitmap ──────────────────────────────────────────────

  let wmBitmap: ImageBitmap | null = null
  if (watermark) wmBitmap = await createImageBitmap(watermark.file)

  // ── Read source file ───────────────────────────────────────────────────────

  onPhase?.('Loading file...')
  const fileBuffer = await file.arrayBuffer()

  // ── WebCodecs + mp4box pipeline ────────────────────────────────────────────

  return new Promise<Uint8Array>((resolve, reject) => {
    let failed = false

    function fail(e: unknown): void {
      if (failed) return
      failed = true
      if (wmBitmap) { try { wmBitmap.close() } catch { /* ignore */ } }
      // Close WebCodecs objects to release GPU decoder/encoder resources immediately.
      // Without this, a mid-decode failure leaves the hardware decoder allocated.
      // Any subsequent WebCodecs export attempt then fails because
      // the GPU slot is still occupied by the leaked instance from this call.
      try { videoDecoder?.close() } catch { /* ignore */ }
      try { videoEncoder?.close() } catch { /* ignore */ }
      try { audioDecoder?.close() } catch { /* ignore */ }
      try { audioEncoder?.close() } catch { /* ignore */ }
      videoDecoder = null
      videoEncoder = null
      audioDecoder = null
      audioEncoder = null
      reject(e instanceof Error ? e : new Error(String(e)))
    }

    const target = new ArrayBufferTarget()
    let muxer: Muxer<ArrayBufferTarget> | null = null

    let videoDecoder: VideoDecoder | null = null
    let videoEncoder: VideoEncoder | null = null
    let audioDecoder: AudioDecoder | null = null
    let audioEncoder: AudioEncoder | null = null

    let videoTrackId   = -1
    let audioTrackId   = -1
    let videoTimescale = 1
    let audioTimescale = 1
    // source frame dimensions (filled once track info is known)
    let srcW = outW, srcH = outH
    // raw coded dims from the container (may differ from display dims for rotated videos)
    let codedW = outW, codedH = outH
    // true when the video has 90° rotation metadata (frame pixels are landscape, display is portrait)
    let isRotated90 = false
    // true when the rotation is 90° CCW (rotate=270); false means 90° CW (rotate=90)
    let isRotatedCCW = false

    let totalVideoSamples = 0
    let fedVideoSamples   = 0
    let processedFrames   = 0
    let estimatedFrames   = 1

    let vFlushDone   = false
    let aFlushDone   = !hasAudio   // if no audio, audio is trivially done
    let flushPending = false

    const keyframeInterval = 60  // 2 s at 30 fps

    // Shared OffscreenCanvas for compositing; re-used for every frame
    const canvas = new OffscreenCanvas(outW, outH)
    const ctx    = canvas.getContext('2d')
    if (!ctx) { fail(new Error('OffscreenCanvas 2D context is unavailable in this browser.')); return }

    function tryFinalize(): void {
      if (!vFlushDone || !aFlushDone || failed || !muxer) return
      try {
        muxer.finalize()
        if (wmBitmap) { try { wmBitmap.close() } catch { /* ignore */ } }
        onProgress(100)
        resolve(new Uint8Array(target.buffer))
      } catch (e) {
        fail(e)
      }
    }

    async function flushAll(): Promise<void> {
      if (failed) return
      // Re-check after each await: fail() may have been called and nulled
      // the decoder/encoder references while this async function was suspended.
      try {
        if (!videoDecoder || !videoEncoder) { fail(new Error('Decoder was released before flush.')); return }
        await videoDecoder.flush()
        if (!videoEncoder) { fail(new Error('Encoder was released before flush.')); return }
        await videoEncoder.flush()
        vFlushDone = true
        if (audioDecoder && audioEncoder) {
          await audioDecoder.flush()
          await audioEncoder.flush()
          aFlushDone = true
        }
        tryFinalize()
      } catch (e) {
        fail(e)
      }
    }

    function scheduleFlush(): void {
      if (flushPending || failed) return
      flushPending = true
      void flushAll()
    }

    const mp4File = MP4Box.createFile()

    mp4File.onError = (err: string) => {
      fail(new Error(`Could not read the video file. It may be corrupt or in an unsupported format. (${err})`))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mp4box info shape is partially typed
    mp4File.onReady = (info: any) => {
      if (failed) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mp4box track types
      const vTrack = info.videoTracks?.[0] as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mp4box track types
      const aTrack = info.audioTracks?.[0] as any

      if (!vTrack) { fail(new Error('No video track found in this file.')); return }

      videoTrackId      = vTrack.id
      videoTimescale    = vTrack.timescale
      totalVideoSamples = vTrack.nb_samples

      // Raw coded dimensions — what VideoDecoder actually receives per-frame.
      codedW = vTrack.video?.width  || vTrack.track_width  || outW
      codedH = vTrack.video?.height || vTrack.track_height || outH
      // Display dimensions for crop/scale math (post-rotation, what the user sees).
      // Phone cameras store video landscape with a rotation tag; the browser's
      // videoWidth/videoHeight reflect the rotated orientation, but mp4box
      // track_width/track_height may still carry the raw coded dimensions.
      // When opts.sourceDims (from the browser) are the swapped coded dims, use
      // those as the authoritative display dimensions.
      const trackDispW = vTrack.track_width  || codedW
      const trackDispH = vTrack.track_height || codedH
      if (opts.sourceDims) {
        const [sdW, sdH] = opts.sourceDims
        const rotated = codedW !== codedH &&
          Math.abs(sdW - codedH) < 8 && Math.abs(sdH - codedW) < 8
        srcW = rotated ? sdW : trackDispW
        srcH = rotated ? sdH : trackDispH
      } else {
        srcW = trackDispW
        srcH = trackDispH
      }
      isRotated90 = codedW !== codedH &&
        Math.abs(codedW - srcH) < 8 &&
        Math.abs(codedH - srcW) < 8
      if (isRotated90) {
        // mp4box exposes the tkhd display matrix as vTrack.matrix (9 values, 16.16 fixed-point).
        // The tkhd matrix uses the column-vector convention: matrix[1] = b = -sin(theta).
        // So matrix[1] > 0 means sin(theta) < 0, which is a 90 CCW display rotation (right col to portrait top).
        //   matrix[1] < 0 (sin > 0): rotate=90 CW  display → raw LEFT  col → portrait TOP
        //   matrix[1] > 0 (sin < 0): rotate=90 CCW display → raw RIGHT col → portrait TOP
        // isRotatedCCW=true signals the CW canvas path (left→top); false signals CCW (right→top).
        const tkhdMatrix = vTrack.matrix as number[] | undefined
        const matrixSin = tkhdMatrix?.[1]
        // eslint-disable-next-line no-console
        console.log('[webcodecs] tkhd matrix[1] =', matrixSin, '→ needsLeftToTop (rotate=90 CW display) =', typeof matrixSin === 'number' && matrixSin < 0)
        isRotatedCCW = typeof matrixSin === 'number' && matrixSin < 0
      }

      const fileDurSec = info.duration / info.timescale
      // Guard against degenerate containers: timescale=0 produces Infinity;
      // duration=0 (valid in some HEVC/screen-capture recordings) produces an
      // enormous fps that makes estimatedFrames millions → progress bar stuck at 0 %.
      // Fall back to the actual trim length so estimatedFrames is at least sane.
      const safeDurSec = Number.isFinite(fileDurSec) && fileDurSec > 0
        ? fileDurSec
        : Math.max(0.001, trimEnd - trimStart)
      const fps        = Math.max(1, Math.round(vTrack.nb_samples / Math.max(0.001, safeDurSec)))
      estimatedFrames  = Math.max(1, Math.round((trimEnd - trimStart) * fps))

      // ── VideoDecoder ───────────────────────────────────────────────────────

      const videoDesc = extractVideoDesc(mp4File, vTrack.id)
      const vCodec    = (vTrack.codec as string) ?? 'avc1.42E01E'

      videoDecoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
          if (failed) { frame.close(); return }

          const origTsSec = frame.timestamp / 1_000_000
          if (origTsSec < trimStart - 0.001 || origTsSec >= trimEnd) {
            frame.close()
            return
          }

          const adjustedTs = (origTsSec - trimStart) * 1_000_000
          const frameDur   = frame.duration ?? 33_333
          const dp         = computeDrawParams(srcW, srcH, outW, outH, cropMode)

          if (dp.needsPad) {
            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, outW, outH)
          }
          if (isRotated90) {
            // Frame pixels are codedW×codedH (landscape). Display is srcW×srcH (portrait).
            // rawSy = codedH - dp.sx - dp.sw for both paths (inverted mapping from display x to raw y).
            //
            //   isRotatedCCW=true  (matrix[1]<0, 90 CW display): raw LEFT  col → portrait TOP
            //     setTransform(0, +dh/rSw, -dw/rSh, 0, dx+dw+rawSy*(dw/rSh), dy-rawSx*(dh/rSw))
            //
            //   isRotatedCCW=false (matrix[1]>0, 90 CCW display): raw RIGHT col → portrait TOP
            //     setTransform(0, -dh/rSw, +dw/rSh, 0, dx-rawSy*(dw/rSh), dy+dh+rawSx*(dh/rSw))
            const rawSx = dp.sy
            const rawSy = codedH - dp.sx - dp.sw
            const rawSw = dp.sh
            const rawSh = dp.sw
            ctx.save()
            ctx.setTransform(
              0,
              isRotatedCCW ? (dp.dh / rawSw) : -(dp.dh / rawSw),
              isRotatedCCW ? -(dp.dw / rawSh) : (dp.dw / rawSh),
              0,
              isRotatedCCW
                ? dp.dx + dp.dw + rawSy * (dp.dw / rawSh)
                : dp.dx - rawSy * (dp.dw / rawSh),
              isRotatedCCW
                ? dp.dy - rawSx * (dp.dh / rawSw)
                : dp.dy + dp.dh + rawSx * (dp.dh / rawSw),
            )
            ctx.drawImage(frame, 0, 0, codedW, codedH)
            ctx.restore()
          } else {
            ctx.drawImage(frame, dp.sx, dp.sy, dp.sw, dp.sh, dp.dx, dp.dy, dp.dw, dp.dh)
          }
          frame.close()  // release GPU memory ASAP

          if (wmBitmap && watermark) drawWatermark(ctx, wmBitmap, watermark, outW, outH)

          const outFrame = new VideoFrame(canvas as CanvasImageSource, {
            timestamp: adjustedTs,
            duration:  frameDur,
          })
          processedFrames++
          onProgress(Math.min(89, Math.round((processedFrames / estimatedFrames) * 89)))

          try {
            videoEncoder!.encode(outFrame, { keyFrame: processedFrames % keyframeInterval === 1 })
          } catch (e) {
            fail(new Error(`Video encoding failed: ${e instanceof Error ? e.message : String(e)}`))
          }
          outFrame.close()
        },
        error: (e: DOMException) => fail(new Error(`Video decode error: ${e.message}`)),
      })

      try {
        videoDecoder.configure({
          codec:              vCodec,
          codedWidth:         codedW,
          codedHeight:        codedH,
          ...(videoDesc ? { description: videoDesc } : {}),
          optimizeForLatency: false,
        })
      } catch (e) {
        fail(new Error(`Video decoder setup failed: ${e instanceof Error ? e.message : String(e)}`))
        return
      }

      // ── VideoEncoder ───────────────────────────────────────────────────────

      const bitrate = quality === '1080p' ? 4_000_000 : 2_000_000

      videoEncoder = new VideoEncoder({
        output: (chunk: EncodedVideoChunk, meta: EncodedVideoChunkMetadata | undefined) => {
          if (failed) return
          try {
            muxer!.addVideoChunk(chunk, meta)
          } catch (e) {
            fail(new Error(`Video mux error: ${e instanceof Error ? e.message : String(e)}`))
          }
        },
        error: (e: DOMException) => fail(new Error(`Video encode error: ${e.message}`)),
      })

      let encoderOk = false
      for (const codec of ['avc1.640033', 'avc1.4d001f', 'avc1.42E01E'] as const) {
        try {
          videoEncoder.configure({ codec, width: outW, height: outH, bitrate, framerate: fps, latencyMode: 'quality' })
          encoderOk = true
          break
        } catch { /* try next profile */ }
      }
      if (!encoderOk) {
        fail(new Error('No supported H.264 encoder profile found in this browser. Try exporting normally.'))
        return
      }

      // ── AudioDecoder + AudioEncoder ────────────────────────────────────────

      if (hasAudio && aTrack) {
        audioTrackId   = aTrack.id
        audioTimescale = aTrack.timescale
        const audioDesc = extractAudioDesc(mp4File, aTrack.id)

        audioDecoder = new AudioDecoder({
          output: (data: AudioData) => {
            if (!failed) audioEncoder!.encode(data)
            data.close()
          },
          error: (e: DOMException) => {
            console.warn('[CalmClip] WebCodecs audio decode error (non-fatal):', e.message)
            aFlushDone = true
            tryFinalize()
          },
        })
        audioEncoder = new AudioEncoder({
          output: (chunk: EncodedAudioChunk, meta: EncodedAudioChunkMetadata | undefined) => {
            if (failed) return
            try {
              muxer!.addAudioChunk(chunk, meta)
            } catch (e) {
              // Non-fatal: a corrupt audio chunk should not abort the whole export.
              console.warn('[CalmClip] Audio mux error (non-fatal):', e instanceof Error ? e.message : String(e))
              aFlushDone = true
              tryFinalize()
            }
          },
          error: (e: DOMException) => {
            console.warn('[CalmClip] WebCodecs audio encode error (non-fatal):', e.message)
            aFlushDone = true
            tryFinalize()
          },
        })

        let audioOk = false
        try {
          audioDecoder.configure({
            codec:            (aTrack.codec as string) ?? 'mp4a.40.2',
            numberOfChannels: aTrack.audio.channel_count,
            sampleRate:       aTrack.audio.sample_rate,
            ...(audioDesc ? { description: audioDesc } : {}),
          })
          audioEncoder.configure({
            codec:            'mp4a.40.2',
            numberOfChannels: aTrack.audio.channel_count,
            sampleRate:       aTrack.audio.sample_rate,
            bitrate:          128_000,
          })
          audioOk = true
        } catch {
          try { audioDecoder.close() } catch { /* ignore */ }
          try { audioEncoder.close() } catch { /* ignore */ }
          audioDecoder = null
          audioEncoder = null
          aFlushDone   = true
        }
        if (!audioOk) audioTrackId = -1
      } else {
        aFlushDone = true
      }

      // ── Muxer ──────────────────────────────────────────────────────────────

      const muxerOpts: MuxerOptions<ArrayBufferTarget> = {
        target,
        video:     { codec: 'avc', width: outW, height: outH },
        fastStart: 'in-memory',
      }
      if (hasAudio && aTrack && audioDecoder) {
        muxerOpts.audio = {
          codec:            'aac',
          numberOfChannels: aTrack.audio.channel_count,
          sampleRate:       aTrack.audio.sample_rate,
        }
      }
      muxer = new Muxer(muxerOpts)

      // ── Start extraction ───────────────────────────────────────────────────

      mp4File.setExtractionOptions(videoTrackId, null, { nbSamples: Infinity })
      if (audioTrackId !== -1 && audioDecoder) {
        mp4File.setExtractionOptions(audioTrackId, null, { nbSamples: Infinity })
      }
      mp4File.seek(trimStart, true)  // seek to nearest keyframe at or before trimStart
      mp4File.start()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mp4box sample shape is partially typed
    mp4File.onSamples = (trackId: number, _user: unknown, samples: any[]) => {
      if (failed || samples.length === 0) return

      if (trackId === videoTrackId) {
        for (const sample of samples) {
          const tsSec = sample.cts / videoTimescale
          if (tsSec >= trimEnd + 0.05) break

          try {
            videoDecoder!.decode(new EncodedVideoChunk({
              type:      sample.is_sync ? 'key' : 'delta',
              timestamp: tsSec * 1_000_000,
              duration:  sample.duration / videoTimescale * 1_000_000,
              data:      sample.data,
            }))
          } catch (e) {
            fail(new Error(`Video chunk decode failed: ${e instanceof Error ? e.message : String(e)}`))
            return
          }
          fedVideoSamples++
        }

        const lastTs = (samples[samples.length - 1]?.cts ?? (trimEnd * videoTimescale)) / videoTimescale
        if (lastTs >= trimEnd || fedVideoSamples >= totalVideoSamples) {
          // Only stop mp4box when there is no audio track being extracted.
          // If we stop here while audio is set up, mp4box halts its extraction
          // loop and the audio track's onSamples callback never fires, producing
          // a silent export. Without stop(), mp4box finishes delivering audio
          // samples before flushAll() awaits anything, so audio arrives in time.
          if (audioTrackId === -1) mp4File.stop()
          scheduleFlush()
        }
      } else if (trackId === audioTrackId && audioDecoder) {
        for (const sample of samples) {
          const tsSec = sample.cts / audioTimescale
          // AAC frames are independently decodable (no inter-frame prediction),
          // so no pre-roll is needed before trimStart. Including samples before
          // trimStart and mapping them to timestamp=0 would place unwanted audio
          // from before the trim point at the start of the export output.
          if (tsSec < trimStart || tsSec >= trimEnd + 0.5) continue
          try {
            audioDecoder.decode(new EncodedAudioChunk({
              type:      sample.is_sync ? 'key' : 'delta',
              timestamp: (tsSec - trimStart) * 1_000_000,
              duration:  sample.duration / audioTimescale * 1_000_000,
              data:      sample.data,
            }))
          } catch { /* individual audio chunk errors are non-fatal */ }
        }
      }
    }

    // Feed the entire file to mp4box in one shot
    const buf = fileBuffer as ArrayBuffer & { fileStart: number }
    buf.fileStart = 0
    mp4File.appendBuffer(buf)
    mp4File.flush()
  })
}
