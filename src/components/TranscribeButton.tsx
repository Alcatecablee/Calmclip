import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, CheckCircle2, Wand2, X } from 'lucide-react'
import { extractAudioFromVideo } from '@/lib/audioExtractor'
import { transcribeToTimedWords } from '@/lib/whisperTranscribe'
import type { Word } from '@/lib/captionEngine'
import type { TranscriptResult } from '@/lib/whisper'
import {
  WHISPER_MODELS, WHISPER_LANGUAGES, type WhisperModelId, getBestCachedModel,
} from '@/lib/whisper'
import { writeCapabilityHint, recordToolUsage } from '@/lib/projectSession'
import {
  startWarmingQueue,
  getWarmingStatus,
  subscribeWarmingStatus,
  unsubscribeWarmingStatus,
  type WarmingStatus,
} from '@/lib/modelWarmer'

const LANG_PREF_KEY  = 'calmclip_lang_pref'

function loadLangPref(): string {
  try { return localStorage.getItem(LANG_PREF_KEY) ?? 'auto' } catch { return 'auto' }
}

function saveLangPref(code: string): void {
  try { localStorage.setItem(LANG_PREF_KEY, code) } catch { /* ignore */ }
}

const PHASES = {
  idle:         'idle',
  extracting:   'extracting',
  downloading:  'downloading',
  loading:      'loading',
  transcribing: 'transcribing',
  done:         'done',
  error:        'error',
} as const

type Phase = typeof PHASES[keyof typeof PHASES]

interface Props {
  videoFile:      File | null
  videoDuration:  number
  trimStart?:     number
  trimEnd?:       number
  hasAudio?:      boolean
  onTranscribed:  (words: Word[]) => void
  onResult?:      (result: TranscriptResult, language?: string) => void
  onProGate?:     () => void
}

function computeOverallPct(msg: string): number | null {
  if (msg === 'Done') return 100
  if (msg.startsWith('Decoding audio')) return 8
  if (msg.startsWith('Extracting audio')) return 4

  const dlMatch = msg.startsWith('Downloading model') ? msg.match(/(\d+)%/) : null
  if (dlMatch) {
    const dl = parseInt(dlMatch[1], 10)
    return 12 + Math.round(dl * 0.60)
  }

  if (msg.startsWith('Loading Whisper') || msg.startsWith('Model ready')) return 75

  const trMatch = msg.startsWith('Transcribing... ') ? msg.match(/(\d+)%/) : null
  if (trMatch) {
    const tr = parseInt(trMatch[1], 10)
    return 82 + Math.round(tr * 0.17)
  }

  if (msg.startsWith('Transcribing')) return 82

  return null
}

export default function TranscribeButton({ videoFile, videoDuration, trimStart = 0, trimEnd, hasAudio = true, onTranscribed, onResult, onProGate }: Props) {
  const [phase, setPhase]           = useState<Phase>(PHASES.idle)
  const [, setStatus]               = useState('')
  const [overallPct, setOverallPct] = useState(0)
  const [error, setError]           = useState<string | null>(null)
  const [modelId, setModelId]       = useState<WhisperModelId>('Xenova/whisper-tiny')
  const [language, setLanguage]     = useState<string>(loadLangPref)
  const [warmingStatus, setWarmingStatus] = useState<WarmingStatus | null>(getWarmingStatus)
  const [pillDismissed, setPillDismissed] = useState(false)
  const fallbackIntervalRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelTranscribeRef         = useRef<(() => void) | null>(null)

  // Auto-select the best already-cached model on mount.
  useEffect(() => {
    getBestCachedModel().then(best => setModelId(best)).catch(() => {})
  }, [])

  // Subscribe to background warming status for the pill indicator.
  useEffect(() => {
    subscribeWarmingStatus(setWarmingStatus)
    return () => unsubscribeWarmingStatus(setWarmingStatus)
  }, [])

  // Re-show the pill whenever a new model starts warming.
  useEffect(() => {
    if (warmingStatus !== null) setPillDismissed(false)
  }, [warmingStatus?.modelId])

  function clearFallback() {
    if (fallbackIntervalRef.current !== null) {
      clearInterval(fallbackIntervalRef.current)
      fallbackIntervalRef.current = null
    }
  }

  function startTranscribeFallback(durationSec: number) {
    clearFallback()
    const RATIO = 3.5
    const expectedMs = Math.max(durationSec, 30) * RATIO * 1000
    const startTs = Date.now()
    fallbackIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTs
      const pct = 82 + Math.round(Math.min(elapsed / expectedMs, 1) * 17)
      setOverallPct(prev => Math.max(prev, Math.min(pct, 99)))
    }, 500)
  }

  const handleTranscribe = async () => {
    if (!videoFile) {
      setError('No video file available for transcription.')
      return
    }

    // Phase 6: track tool usage before starting so even failed attempts count.
    recordToolUsage('transcribe').catch(() => {})

    setPhase(PHASES.extracting)
    setOverallPct(4)
    setError(null)
    setStatus('')

    // The audio duration is the trimmed segment, not the full video.
    // This drives progress estimation and the distributeWords fallback.
    const resolvedTrimStart = trimStart ?? 0
    const resolvedTrimEnd   = trimEnd ?? null
    const audioDuration = resolvedTrimEnd !== null
      ? Math.max(1, resolvedTrimEnd - resolvedTrimStart)
      : (videoDuration || 60)

    let audioBlob: Blob
    try {
      audioBlob = await extractAudioFromVideo(videoFile, resolvedTrimStart, resolvedTrimEnd)
    } catch (e) {
      setPhase(PHASES.error)
      setError('Failed to extract audio: ' + (e as Error).message)
      return
    }

    setPhase(PHASES.downloading)
    setOverallPct(12)

    let words: Word[]
    let transcript: string
    let detectedLanguage: string | undefined
    try {
      const handle = transcribeToTimedWords(
        audioBlob,
        audioDuration,
        (msg) => {
          setStatus(msg)
          const pct = computeOverallPct(msg)
          if (pct !== null) setOverallPct(prev => Math.max(prev, pct))
          if (msg.startsWith('Downloading model')) {
            setPhase(PHASES.downloading)
          } else if (msg.startsWith('Loading Whisper') || msg.startsWith('Model ready')) {
            setPhase(PHASES.loading)
          } else if (msg.startsWith('Transcribing')) {
            setPhase(PHASES.transcribing)
            startTranscribeFallback(audioDuration)
          } else if (msg === 'Done') {
            clearFallback()
            setPhase(PHASES.done)
          }
        },
        modelId,
        language !== 'auto' ? language : undefined,
        resolvedTrimStart,
      )
      cancelTranscribeRef.current = handle.cancel
      const result = await handle.promise
      cancelTranscribeRef.current = null
      words            = result.words
      transcript       = result.transcript
      detectedLanguage = result.detectedLanguage
    } catch (e) {
      clearFallback()
      cancelTranscribeRef.current = null
      if ((e as Error).message === 'cancelled') {
        setPhase(PHASES.idle)
        setError(null)
        setStatus('')
        return
      }
      setPhase(PHASES.error)
      setError('Transcription failed: ' + (e as Error).message)
      return
    }

    clearFallback()
    setOverallPct(100)
    setPhase(PHASES.done)
    onTranscribed(words)

    if (onResult) {
      const transcriptResult: TranscriptResult = {
        text: transcript,
        chunks: words.map(w => ({
          text:      ' ' + w.text,
          timestamp: [w.startTime, w.endTime] as [number, number | null],
        })),
      }
      const resolvedLanguage = detectedLanguage ?? (language !== 'auto' ? language : undefined)
      onResult(transcriptResult, resolvedLanguage)
    }

    // Phase 2: write capability hint so Phase 3 warming picks the right next model.
    if (detectedLanguage) {
      writeCapabilityHint(detectedLanguage, modelId).catch(() => {})
    }

    // Phase 3: start background model warming while the user edits.
    startWarmingQueue(modelId).catch(() => {})
  }

  const handleManualTranscript = () => {
    onTranscribed([
      { text: 'Type',       startTime: 0,   endTime: 0.4 },
      { text: 'your',       startTime: 0.4, endTime: 0.8 },
      { text: 'transcript', startTime: 0.8, endTime: 1.4 },
      { text: 'in',         startTime: 1.4, endTime: 1.6 },
      { text: 'the',        startTime: 1.6, endTime: 1.8 },
      { text: 'editor',     startTime: 1.8, endTime: 2.4 },
      { text: 'below',      startTime: 2.4, endTime: 3.0 },
    ])
  }

  const handleRetry = () => {
    setPhase(PHASES.idle)
    setError(null)
    setStatus('')
  }

  // A video without an audio track cannot be transcribed. Show a clear message
  // rather than letting the extraction fail silently inside FFmpeg.
  if (!hasAudio && videoFile) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        No audio track detected. Transcription requires a video with speech.
      </p>
    )
  }

  const isProcessing = phase !== PHASES.idle && phase !== PHASES.done && phase !== PHASES.error

  const stepLabels: Record<Phase, string> = {
    [PHASES.idle]:         '',
    [PHASES.extracting]:   'Extracting audio...',
    [PHASES.downloading]:  'Downloading processing engine',
    [PHASES.loading]:      'Preparing model...',
    [PHASES.transcribing]: 'Transcribing...',
    [PHASES.done]:         'Transcription complete',
    [PHASES.error]:        'Error',
  }

  return (
    <div className="space-y-2">
      {/* Language selector */}
      <select
        disabled={isProcessing}
        value={language}
        onChange={e => { setLanguage(e.target.value); saveLangPref(e.target.value) }}
        className="w-full rounded px-2 py-1 text-xs"
        style={{
          background: 'var(--bg-surface)',
          color:      'var(--text-muted)',
          border:     '1px solid var(--border)',
          cursor:     isProcessing ? 'not-allowed' : 'pointer',
          opacity:    isProcessing ? 0.5 : 1,
        }}
      >
        {WHISPER_LANGUAGES.map(l => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>

      <Button
        onClick={() => { if (onProGate && !isProcessing) { onProGate(); return } handleTranscribe() }}
        className="w-full font-semibold"
        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        size="sm"
        disabled={isProcessing || !videoFile}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : phase === PHASES.done ? (
          <CheckCircle2 className="w-4 h-4 mr-2" />
        ) : (
          <Wand2 className="w-4 h-4 mr-2" />
        )}
        {isProcessing
          ? stepLabels[phase] || 'Processing...'
          : phase === PHASES.done
            ? 'Re-transcribe'
            : 'Auto-Transcribe with Whisper'}
        {onProGate && !isProcessing && (
          <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', background: 'rgba(255,255,255,0.22)', borderRadius: 3, padding: '1px 5px' }}>PRO</span>
        )}
      </Button>

      {!isProcessing && phase !== PHASES.error && (
        <p className="text-center" style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
          Using Whisper {WHISPER_MODELS.find(m => m.id === modelId)?.label ?? 'Base'}
        </p>
      )}

      {isProcessing && (
        <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Loader2 className="w-3 h-3 animate-spin shrink-0" />
              <span>{stepLabels[phase]}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--primary)' }}>
                {overallPct}%
              </span>
              <button
                onClick={() => {
                  cancelTranscribeRef.current?.()
                  clearFallback()
                  setPhase(PHASES.idle)
                  setError(null)
                  setStatus('')
                  setOverallPct(0)
                }}
                title="Cancel"
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  width:          18,
                  height:         18,
                  borderRadius:   4,
                  border:         '1px solid var(--border)',
                  background:     'transparent',
                  color:          'var(--text-faint)',
                  cursor:         'pointer',
                  flexShrink:     0,
                }}
              >
                <X size={10} />
              </button>
            </div>
          </div>

          {phase === PHASES.downloading && (
            <p className="mt-1 text-[10px]" style={{ color: 'var(--text-faint)' }}>
              One-time download (~{WHISPER_MODELS.find(m => m.id === modelId)?.size ?? '37 MB'}). After this, the app works fully offline.
            </p>
          )}

          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${overallPct}%`, background: 'var(--primary)' }}
            />
          </div>
        </div>
      )}

      {phase === PHASES.done && !isProcessing && (
        <div className="flex items-center gap-2 text-xs" style={{ color: '#10b981' }}>
          <CheckCircle2 className="w-3 h-3" />
          Transcription complete. Edit words below.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-xs rounded-lg p-2" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{error}</p>
            <button onClick={handleRetry} className="underline mt-1" style={{ color: 'rgba(239,68,68,0.8)' }}>Try again</button>
          </div>
        </div>
      )}

      <Button
        onClick={handleManualTranscript}
        variant="ghost"
        className="w-full text-xs"
        style={{ color: 'var(--text-muted)' }}
        size="sm"
        disabled={isProcessing}
      >
        Or type manually
      </Button>

      {/* Background warming pill: dismiss on click, re-appears for each new model */}
      {warmingStatus && !pillDismissed && (
        <button
          onClick={() => setPillDismissed(true)}
          className="w-full text-left rounded-lg px-3 py-2"
          style={{
            background:   'var(--bg-surface)',
            border:       '1px solid var(--border)',
            borderRadius: '8px',
            cursor:       'pointer',
          }}
          title="Click to dismiss"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {warmingStatus.done
                ? `${warmingStatus.modelLabel} model ready`
                : `Upgrading accuracy (${warmingStatus.modelLabel})...`}
            </span>
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--primary)' }}>
              {warmingStatus.done ? 'Done' : `${warmingStatus.progress}%`}
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width:      `${warmingStatus.done ? 100 : warmingStatus.progress}%`,
                background: 'var(--primary)',
              }}
            />
          </div>
        </button>
      )}
    </div>
  )
}
