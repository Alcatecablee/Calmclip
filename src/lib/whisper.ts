import { loadFfmpeg, fetchFile, acquireFfmpegLock, releaseFfmpegLock, runFfmpegWithWatchdog } from './ffmpeg'
import { writeModelSentinel } from './projectSession'

export interface TranscriptChunk {
  text:       string
  timestamp:  [number, number | null]
}

export interface TranscriptResult {
  text:   string
  chunks: TranscriptChunk[]
}

export type WhisperStatus =
  | { phase: 'idle' }
  | { phase: 'loading-model'; progress: number; label: string }
  | { phase: 'extracting-audio' }
  | { phase: 'transcribing'; progress: number; durationSec: number; backend?: 'webgpu' | 'wasm' }
  | { phase: 'done'; result: TranscriptResult; detectedLanguage?: string }
  | { phase: 'error'; message: string }

// Top languages by global speaker count that Whisper handles reliably.
// 'auto' means no language hint: Whisper detects from audio.
export const WHISPER_LANGUAGES: { code: string; label: string }[] = [
  { code: 'auto',       label: 'Auto-detect' },
  { code: 'english',    label: 'English' },
  { code: 'spanish',    label: 'Spanish' },
  { code: 'portuguese', label: 'Portuguese' },
  { code: 'french',     label: 'French' },
  { code: 'german',     label: 'German' },
  { code: 'italian',    label: 'Italian' },
  { code: 'dutch',      label: 'Dutch' },
  { code: 'polish',     label: 'Polish' },
  { code: 'russian',    label: 'Russian' },
  { code: 'ukrainian',  label: 'Ukrainian' },
  { code: 'arabic',     label: 'Arabic' },
  { code: 'turkish',    label: 'Turkish' },
  { code: 'hindi',      label: 'Hindi' },
  { code: 'chinese',    label: 'Chinese' },
  { code: 'japanese',   label: 'Japanese' },
  { code: 'korean',     label: 'Korean' },
  { code: 'swedish',    label: 'Swedish' },
  { code: 'norwegian',  label: 'Norwegian' },
  { code: 'danish',     label: 'Danish' },
]

export async function extractAudioForWhisper(
  file: File,
  trimStart: number,
  trimEnd: number,
): Promise<Float32Array> {
  const TARGET_SR = 16000

  acquireFfmpegLock()
  try {
    const ff = await loadFfmpeg()
    const inputName = 'temp_whisper_input.mp4'
    const outputName = 'temp_whisper_output.wav'

    try {
      await ff.writeFile(inputName, await fetchFile(file))

      const duration = trimEnd - trimStart
      try {
        await runFfmpegWithWatchdog(ff, [
          '-ss', String(trimStart),
          '-t', String(duration),
          '-i', inputName,
          '-vn',
          '-acodec', 'pcm_s16le',
          '-ar', String(TARGET_SR),
          '-ac', '1',
          outputName
        ], 120_000)
      } catch (err) {
        throw new Error(`Failed to extract audio for transcription. Ensure the file has a valid audio track. (${err instanceof Error ? err.message : String(err)})`)
      }

      const data = (await ff.readFile(outputName)) as Uint8Array

      const wavBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer

      const ctx = new AudioContext({ sampleRate: TARGET_SR })
      let decoded: AudioBuffer
      try {
        decoded = await ctx.decodeAudioData(wavBuffer)
      } catch {
        await ctx.close()
        throw new Error('Could not decode extracted audio. Ensure the file contains a valid audio track.')
      }

      try {
        const raw = decoded.getChannelData(0)
        let peak = 0
        for (let i = 0; i < raw.length; i++) {
          const abs = Math.abs(raw[i])
          if (abs > peak) peak = abs
        }
        if (peak > 0.02 && peak < 0.9) {
          const gain = 0.9 / peak
          const normalised = new Float32Array(raw.length)
          for (let i = 0; i < raw.length; i++) normalised[i] = raw[i] * gain
          return normalised
        }
        return raw
      } finally {
        await ctx.close()
      }
    } finally {
      ff.deleteFile(inputName).catch(() => {})
      ff.deleteFile(outputName).catch(() => {})
    }
  } finally {
    releaseFfmpegLock()
  }
}

export type WhisperModelId =
  | 'Xenova/whisper-tiny'
  | 'Xenova/whisper-base'
  | 'Xenova/whisper-small'
  | 'Xenova/whisper-medium'

export interface WhisperModel {
  id:          WhisperModelId
  label:       string
  size:        string
  speed:       string
  description: string
  warning?:    string
}

export const WHISPER_MODELS: WhisperModel[] = [
  {
    id:          'Xenova/whisper-tiny',
    label:       'Tiny',
    size:        '39 MB',
    speed:       'Fastest',
    description: 'Best for short clips with clear, studio-quality audio. Struggles with accents, background noise, or fast speech.',
  },
  {
    id:          'Xenova/whisper-base',
    label:       'Base',
    size:        '74 MB',
    speed:       'Fast',
    description: 'Good for most everyday recordings. Handles a range of voices and speaking styles. Some errors on heavy accents or noisy audio.',
  },
  {
    id:          'Xenova/whisper-small',
    label:       'Small',
    size:        '244 MB',
    speed:       'Moderate',
    description: 'Noticeably more accurate on accents, background noise, and technical terms. Takes longer on clips over a few minutes.',
  },
  {
    id:          'Xenova/whisper-medium',
    label:       'Medium',
    size:        '769 MB',
    speed:       'Slow',
    description: 'Highest accuracy available in the browser. Best for difficult audio, strong accents, or dense technical content.',
    warning:     'Very slow on long clips. Expect several minutes. Only use if smaller models miss too many words.',
  },
]

export function createWhisperWorker(
  onStatus: (s: WhisperStatus) => void,
): { run: (audio: Float32Array, model: WhisperModelId, language?: string) => void; terminate: () => void } {
  const worker = new Worker(
    new URL('../workers/whisper.worker.ts', import.meta.url),
    { type: 'module' },
  )

  worker.onerror = (err: ErrorEvent) => {
    console.error('Whisper worker error:', err.message, err.filename, err.lineno, err.error)

    const isLoadFailure = !err.message && !err.filename && !err.error

    const message = isLoadFailure
      ? 'The speech engine could not load in this embedded preview. Open the app in a new browser tab (Chrome or Firefox) and it will work normally.'
      : `Failed to initialize the local speech recognition engine${err.message && err.message !== 'error' ? ` (${err.message})` : ''}. Your browser may block ES module workers or the Hugging Face CDN may be unreachable. Try Chrome or Firefox on a stable connection.`

    onStatus({ phase: 'error', message })
  }

  let knownBackend: 'webgpu' | 'wasm' | undefined = undefined

  worker.onmessage = (e: MessageEvent) => {
    const { type } = e.data
    if (type === 'model-progress') {
      const { info } = e.data
      const label    = info.file ?? info.name ?? 'model'
      const progress = info.progress != null ? Math.round(info.progress) : 0
      onStatus({ phase: 'loading-model', progress, label })
    } else if (type === 'transcribing') {
      knownBackend = e.data.backend
      onStatus({ phase: 'transcribing', progress: 2, durationSec: e.data.durationSec ?? 0, backend: knownBackend })
    } else if (type === 'transcribe-progress') {
      onStatus({ phase: 'transcribing', progress: e.data.progress ?? 2, durationSec: e.data.durationSec ?? 0, backend: knownBackend })
    } else if (type === 'result') {
      const raw = e.data.result
      onStatus({
        phase:  'done',
        result: {
          text:   raw.text?.trim() ?? '',
          chunks: Array.isArray(raw.chunks)
            ? raw.chunks.map((c: { text: string; timestamp: [number, number | null] }) => ({
                text:      c.text,
                timestamp: c.timestamp,
              }))
            : [],
        },
        detectedLanguage: e.data.detectedLanguage ?? undefined,
      })
    } else if (type === 'model-cached') {
      writeModelSentinel(e.data.modelId).catch(() => {})
    } else if (type === 'error') {
      onStatus({ phase: 'error', message: e.data.message })
    }
  }

  return {
    run:       (audio: Float32Array, model: WhisperModelId, language?: string) => worker.postMessage({ type: 'transcribe', audio, model, durationSec: audio.length / 16000, language }),
    terminate: () => worker.terminate(),
  }
}

// Phase 3: returns the best Whisper model that is verifiably cached in the browser.
// Falls back to whisper-tiny (the default) if nothing better is confirmed present.
export async function getBestCachedModel(): Promise<WhisperModelId> {
  const ORDER: WhisperModelId[] = [
    'Xenova/whisper-medium',
    'Xenova/whisper-small',
    'Xenova/whisper-base',
  ]
  try {
    const { readModelSentinels, clearModelSentinel } = await import('./projectSession')
    const sentinels = new Set(await readModelSentinels())
    for (const modelId of ORDER) {
      if (!sentinels.has(modelId)) continue
      const ok = await verifyCachedShard(modelId)
      if (ok) return modelId
      await clearModelSentinel(modelId)
    }
  } catch { /* fall through */ }
  return 'Xenova/whisper-tiny'
}

async function verifyCachedShard(modelId: string): Promise<boolean> {
  try {
    const cache = await caches.open('transformers-cache')
    const keys  = await cache.keys()
    const slug  = modelId.split('/').pop() ?? modelId
    return keys.some(r => r.url.includes(slug) && r.url.includes('encoder_model'))
  } catch { return false }
}

// Languages whose scripts are Latin-based. Used to select the correct
// text normalizer in detectFillerWords.
const LATIN_SCRIPT_LANGUAGES = new Set([
  'english', 'spanish', 'portuguese', 'french', 'german', 'italian',
  'dutch', 'polish', 'turkish', 'swedish', 'norwegian', 'danish',
])

// Filler words keyed by the language code Whisper returns (lowercase, no
// region suffix). Each list contains the exact forms Whisper outputs so
// the exact-match comparison works without further normalisation.
export const FILLER_WORDS_BY_LANGUAGE: Record<string, string[]> = {
  english:    ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally', 'sort of', 'kind of', 'right'],
  spanish:    ['este', 'bueno', 'pues', 'o sea', 'osea', 'verdad'],
  portuguese: ['tipo', 'sabe', 'assim', 'entao', 'então', 'né'],
  french:     ['euh', 'ben', 'bah', 'quoi', 'enfin'],
  german:     ['äh', 'ähm', 'halt', 'irgendwie', 'sozusagen'],
  italian:    ['allora', 'cioè', 'cioe', 'praticamente', 'insomma'],
  dutch:      ['eh', 'uhm', 'eigenlijk', 'gewoon', 'zeg maar'],
  polish:     ['no', 'właśnie', 'znaczy', 'jakby'],
  russian:    ['ну', 'вот', 'это', 'короче', 'типа'],
  ukrainian:  ['ну', 'от', 'це', 'типу'],
  arabic:     ['يعني', 'بس', 'اه'],
  turkish:    ['yani', 'şey', 'falan'],
  hindi:      ['मतलब', 'वो', 'तो', 'जैसे'],
  chinese:    ['那个', '就是', '然后', '对吧', '嗯'],
  japanese:   ['えっと', 'あの', 'その', 'なんか', 'ね'],
  korean:     ['어', '그', '뭐', '이제', '음'],
  swedish:    ['liksom', 'alltså', 'typ', 'asså'],
  norwegian:  ['liksom', 'altså', 'sant'],
  danish:     ['øh', 'altså', 'ligesom'],
}

// English list kept as a named export for backward compatibility.
export const FILLER_WORDS = FILLER_WORDS_BY_LANGUAGE['english']

// Normalize a chunk's text for exact-match comparison.
// Latin-script languages: lowercase and strip non-letter characters other
// than space and common accented letters. Non-Latin scripts only have
// leading/trailing punctuation stripped so CJK, Arabic, Cyrillic etc.
// are not zeroed out.
function normalizeChunk(text: string, isLatin: boolean): string {
  const t = text.trim().toLowerCase()
  if (isLatin) {
    return t.replace(/[^a-záàâäãéèêëíìîïóòôöõúùûüýñçœşğı ]/g, '').trim()
  }
  return t.replace(/^[.,!?;:'"()\-。、！？،؟]+|[.,!?;:'"()\-。、！？،؟]+$/g, '').trim()
}

export function detectFillerWords(chunks: TranscriptChunk[], language?: string): TranscriptChunk[] {
  const lang = language ?? 'english'
  const wordList = FILLER_WORDS_BY_LANGUAGE[lang] ?? FILLER_WORDS_BY_LANGUAGE['english']
  const isLatin = LATIN_SCRIPT_LANGUAGES.has(lang)
  return chunks.filter(c => {
    const normalized = normalizeChunk(c.text ?? '', isLatin)
    return wordList.some(fw => normalized === fw)
  })
}
