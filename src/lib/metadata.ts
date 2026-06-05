export interface VideoMeta {
  hasGps:        boolean
  gpsString:     string | null
  hasDeviceInfo: boolean
  hasTimestamp:  boolean
  flagCount:     number
  hasAudio:      boolean
}

const GPS_MARKERS    = ['\xa9xyz', 'loci', '\x00\x00\x00\x00\xa9xyz']
const DEVICE_MARKERS = ['\xa9mak', '\xa9mod', '\xa9swr', 'cprt']

// ---------------------------------------------------------------------------
// ISO BMFF (MP4 / MOV) box parser
// Walks moov > trak > mdia > hdlr and returns true when handler_type = 'soun'.
// ---------------------------------------------------------------------------
function detectAudioBoxes(buffer: ArrayBuffer): boolean {
  const view = new DataView(buffer)
  const len  = buffer.byteLength

  function walkBoxes(start: number, end: number): boolean {
    let pos = start
    while (pos + 8 <= end) {
      let size = view.getUint32(pos)
      const type = String.fromCharCode(
        view.getUint8(pos + 4),
        view.getUint8(pos + 5),
        view.getUint8(pos + 6),
        view.getUint8(pos + 7),
      )
      if (size === 0) {
        size = end - pos
      } else if (size === 1) {
        // 64-bit extended size: beyond our 2 MB scan window, stop
        break
      }
      if (size < 8) break
      const boxEnd = Math.min(pos + size, end)
      if (type === 'moov' || type === 'trak' || type === 'mdia') {
        if (walkBoxes(pos + 8, boxEnd)) return true
      } else if (type === 'hdlr') {
        // FullBox: version(1) + flags(3) + pre_defined(4) + handler_type(4)
        const htPos = pos + 16
        if (htPos + 4 <= boxEnd) {
          const ht = String.fromCharCode(
            view.getUint8(htPos),
            view.getUint8(htPos + 1),
            view.getUint8(htPos + 2),
            view.getUint8(htPos + 3),
          )
          if (ht === 'soun') return true
        }
      }
      pos += size
    }
    return false
  }

  return walkBoxes(0, len)
}

// ---------------------------------------------------------------------------
// EBML / Matroska parser for WebM and MKV
// Looks for a TrackEntry (element ID 0xAE) whose TrackType (0x83) = 2 (audio).
// ---------------------------------------------------------------------------
function detectAudioEbml(buffer: ArrayBuffer): boolean {
  const view = new DataView(buffer)
  const len  = buffer.byteLength

  // EBML magic: first 4 bytes = 1A 45 DF A3
  if (
    len < 4 ||
    view.getUint8(0) !== 0x1a ||
    view.getUint8(1) !== 0x45 ||
    view.getUint8(2) !== 0xdf ||
    view.getUint8(3) !== 0xa3
  ) return false

  // Read a variable-length EBML integer (used for both element IDs and sizes).
  // Returns [value, bytesConsumed] or null if out of bounds.
  function readVint(pos: number): [number, number] | null {
    if (pos >= len) return null
    const first = view.getUint8(pos)
    if (first === 0) return null
    // Number of leading zero bits determines the width
    const width = Math.clz32(first) - 24 + 1  // clz32 counts from bit 31
    if (pos + width > len) return null
    let value = first & (0xff >> width)
    for (let i = 1; i < width; i++) {
      value = (value << 8) | view.getUint8(pos + i)
    }
    return [value, width]
  }

  // Read an element ID (same VINT encoding but we keep the leading size bit).
  function readId(pos: number): [number, number] | null {
    if (pos >= len) return null
    const first = view.getUint8(pos)
    if (first === 0) return null
    const width = Math.clz32(first) - 24 + 1
    if (pos + width > len) return null
    let id = first
    for (let i = 1; i < width; i++) {
      id = (id << 8) | view.getUint8(pos + i)
    }
    return [id, width]
  }

  // Walk a segment of the EBML tree.
  function walkEbml(start: number, end: number, depth: number): boolean {
    if (depth > 6) return false
    let pos = start
    while (pos < end) {
      const idResult   = readId(pos)
      if (!idResult) break
      const [id, idLen] = idResult
      pos += idLen

      const szResult   = readVint(pos)
      if (!szResult) break
      const [sz, szLen] = szResult
      pos += szLen

      // Unknown / indefinite size: stop processing this level
      if (sz === (1 << (7 * szLen)) - 1) break

      const elemEnd = Math.min(pos + sz, end)

      // Segment (0x18538067), Cluster container (0x1F43B675),
      // Tracks (0x1654AE6B), TrackEntry (0xAE)
      if (id === 0x18538067 || id === 0x1654AE6B || id === 0xAE) {
        if (walkEbml(pos, elemEnd, depth + 1)) return true
      } else if (id === 0x83 && sz >= 1) {
        // TrackType: 0x02 = audio
        if (view.getUint8(pos) === 0x02) return true
      }

      pos = elemEnd
    }
    return false
  }

  return walkEbml(0, len, 0)
}

// ---------------------------------------------------------------------------
// Silence check using Web Audio API (for files up to DECODE_LIMIT bytes).
// Returns true if any decoded sample exceeds the audibility threshold,
// false if the audio is completely silent, null if decoding is not possible
// (unsupported codec, file too large, or API unavailable).
// ---------------------------------------------------------------------------
const DECODE_LIMIT    = 10 * 1024 * 1024   // 10 MB
const SILENCE_THRESH  = 5e-4               // ~0.05% of full scale
const SAMPLE_POINTS   = 600               // frames to inspect (evenly spaced)

async function checkAudioContent(file: File): Promise<boolean | null> {
  if (file.size > DECODE_LIMIT) return null
  if (typeof AudioContext === 'undefined') return null

  const ctx = new AudioContext()
  try {
    const buffer  = await file.arrayBuffer()
    const decoded = await ctx.decodeAudioData(buffer)
    if (decoded.length === 0 || decoded.numberOfChannels === 0) return false
    const step = Math.max(1, Math.floor(decoded.length / SAMPLE_POINTS))
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const data = decoded.getChannelData(ch)
      for (let i = 0; i < data.length; i += step) {
        if (Math.abs(data[i]) > SILENCE_THRESH) return true
      }
    }
    return false
  } catch {
    // Codec unsupported or file is not a recognised audio/video format
    return null
  } finally {
    ctx.close()
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export async function parseVideoMeta(file: File): Promise<VideoMeta> {
  const SCAN_BYTES = 2 * 1024 * 1024

  const startBuffer = await file.slice(0, Math.min(file.size, SCAN_BYTES)).arrayBuffer()
  const startText   = new TextDecoder('latin1').decode(startBuffer)

  let text      = startText
  let endBuffer: ArrayBuffer | null = null
  if (file.size > SCAN_BYTES) {
    endBuffer       = await file.slice(file.size - SCAN_BYTES, file.size).arrayBuffer()
    const endText   = new TextDecoder('latin1').decode(endBuffer)
    text = startText + '\n[...]\n' + endText
  }

  let hasGps    = false
  let gpsString: string | null = null

  for (const marker of GPS_MARKERS) {
    const idx = text.indexOf(marker)
    if (idx !== -1) {
      hasGps = true
      const raw     = text.slice(idx + 8, idx + 50)
      const cleaned = raw.replace(/[^\x20-\x7e+\-.]/g, '').trim()
      if (cleaned.length > 3) gpsString = cleaned
      break
    }
  }

  const hasDeviceInfo = DEVICE_MARKERS.some(m => text.includes(m))
  const hasTimestamp  = text.includes('\xa9day')

  // Step 1: check the container structure for an audio track declaration.
  // detectAudioBoxes handles MP4/MOV; detectAudioEbml handles WebM/MKV.
  // Many recorders write the moov atom at the END of the file (non-faststart),
  // so we scan both the start buffer and the end buffer when available.
  const containerHasAudio =
    detectAudioBoxes(startBuffer) || detectAudioEbml(startBuffer) ||
    (endBuffer !== null && (detectAudioBoxes(endBuffer) || detectAudioEbml(endBuffer)))

  // Step 2: for files within the decode limit, use the Web Audio API to
  // confirm that the audio track contains non-silent samples.  This catches
  // the common case where a recorder writes an empty or fully-silent audio
  // stream into the container.  If decoding is not possible (unsupported
  // codec, file too large) we fall back to the container result.
  let hasAudio: boolean
  if (containerHasAudio) {
    const audible = await checkAudioContent(file)
    hasAudio = audible !== null ? audible : true
  } else {
    // No audio track found in the container.
    // Still run the content check: covers formats the box parsers do not
    // handle (e.g. AVI, MXF) where the browser may still decode audio.
    const audible = await checkAudioContent(file)
    // null means "unable to check" (file too large or codec unsupported):
    // treat that as audio present rather than absent to avoid false negatives.
    hasAudio = audible !== false
  }

  const flagCount = [hasGps, hasDeviceInfo, hasTimestamp].filter(Boolean).length

  return { hasGps, gpsString, hasDeviceInfo, hasTimestamp, flagCount, hasAudio }
}
