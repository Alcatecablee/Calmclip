import { pipeline, env } from '@xenova/transformers'

env.allowLocalModels = false
env.useBrowserCache  = true

type ProgressInfo = { status: string; name?: string; file?: string; progress?: number; loaded?: number; total?: number }

// `any` is required here: @xenova/transformers does not ship TypeScript types
// for its pipeline return value, and the shape varies by task type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _transcriber: any = null
let _loadedModel: string = ''
let _usedWebGPU: boolean = false

// Aggregate model-download progress across all files so the displayed % never
// jumps backwards and never falsely hits 100% before all files are done.
let _totalFiles    = 0
let _lastSentPct   = 0
const _fileProgress = new Map<string, number>()

function computeAggregateProgress(): number {
  if (_totalFiles === 0) return 0
  let sum = 0
  for (const pct of _fileProgress.values()) sum += pct
  const agg = Math.round(sum / _totalFiles)
  _lastSentPct = Math.max(_lastSentPct, Math.min(agg, 99)) // cap at 99 until fully done
  return _lastSentPct
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, audio, durationSec, model, language } = event.data as { type: string; audio: Float32Array; durationSec: number; model: string; language?: string }

  if (type !== 'transcribe') return

  // Declared outside try/catch so both blocks can reference it.
  let progressInterval: ReturnType<typeof setInterval> | null = null

  const modelId = model || 'Xenova/whisper-tiny'

  try {
    if (!_transcriber || _loadedModel !== modelId) {
      // Different model selected: discard the old pipeline so it gets reloaded.
      _transcriber = null
      _loadedModel = modelId
      _totalFiles  = 0
      _lastSentPct = 0
      _usedWebGPU  = false
      _fileProgress.clear()
      self.postMessage({ type: 'model-progress', info: { status: 'init', progress: 0, file: 'Initializing...' } })

      const progressCb = (info: ProgressInfo) => {
        const key = info.file ?? info.name ?? 'unknown'
        if (info.status === 'initiate') {
          if (!_fileProgress.has(key)) {
            _totalFiles++
            _fileProgress.set(key, 0)
          }
        } else if (info.status === 'progress' && info.progress != null) {
          _fileProgress.set(key, info.progress)
          const progress = computeAggregateProgress()
          self.postMessage({ type: 'model-progress', info: { ...info, progress } })
        } else if (info.status === 'done') {
          _fileProgress.set(key, 100)
          const progress = computeAggregateProgress()
          self.postMessage({ type: 'model-progress', info: { ...info, progress } })
        } else if (info.status === 'ready') {
          _fileProgress.set(key, 100)
          const progress = computeAggregateProgress()
          self.postMessage({ type: 'model-progress', info: { ...info, progress } })
        }
      }

      // Try WebGPU first: hardware-accelerated inference is typically 3 to 10x faster.
      // Fall back to the WASM backend if WebGPU is unavailable or throws.
      if ('gpu' in navigator) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          _transcriber = await (pipeline as (...args: any[]) => Promise<any>)(
            'automatic-speech-recognition',
            modelId,
            { device: 'webgpu', progress_callback: progressCb },
          )
          _usedWebGPU = true
        } catch {
          // WebGPU load failed (driver issue, unsupported hardware, etc.).
          // Reset progress counters and retry with WASM.
          _transcriber = null
          _totalFiles  = 0
          _lastSentPct = 0
          _fileProgress.clear()
        }
      }

      if (!_transcriber) {
        _transcriber = await pipeline(
          'automatic-speech-recognition',
          modelId,
          { progress_callback: progressCb },
        )
        _usedWebGPU = false
      }
    }

    self.postMessage({ type: 'transcribing', durationSec, backend: _usedWebGPU ? 'webgpu' : 'wasm' })

    // Emit estimated transcription progress every 500 ms.
    // Whisper base WASM processes at roughly 1-2x real-time; we use 2x as a
    // conservative estimate so the bar moves at a believable pace and caps at
    // 95% until the result arrives.
    // NOTE: WASM often blocks the worker's JS event loop, so these ticks may
    // not fire reliably. The main thread computes its own fallback progress.
    const PROCESSING_RATIO = 2.0
    const expectedMs = (durationSec > 0 ? durationSec : 60) * PROCESSING_RATIO * 1000
    const startTs = Date.now()
    progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTs
      const pct = Math.min(95, Math.round((elapsed / expectedMs) * 100))
      self.postMessage({ type: 'transcribe-progress', progress: pct, durationSec })
    }, 500)

    // `any` is required here: the pipeline result type is not exported by
    // @xenova/transformers and varies depending on the task and options passed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await _transcriber(audio, {
      return_timestamps: 'word',
      chunk_length_s:    30,
      stride_length_s:   5,
      ...(language ? { language } : {}),
      task:              'transcribe',
    })

    // Strip Whisper's internal special tokens (e.g. [BLANK_AUDIO], [MUSIC],
    // [NOISE], [NO_SPEECH]) and any leftover timestamp tokens (<|0.00|>) before
    // sending the result back to the main thread.
    const SPECIAL_TOKEN_RE = /\[.*?\]|<\|[^|]+\|>/g
    const cleanText = (result.text ?? '').replace(SPECIAL_TOKEN_RE, '').trim()
    const cleanChunks = (result.chunks ?? []).map((c: { text: string; timestamp: [number, number | null] }) => ({
      ...c,
      text: c.text.replace(SPECIAL_TOKEN_RE, '').trim(),
    })).filter((c: { text: string }) => c.text.length > 0)

    if (progressInterval !== null) clearInterval(progressInterval)
    self.postMessage({ type: 'result', result: { ...result, text: cleanText, chunks: cleanChunks }, detectedLanguage: result.language ?? null })
  } catch (err) {
    if (progressInterval !== null) clearInterval(progressInterval)
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : 'Transcription failed.' })
  }
})
