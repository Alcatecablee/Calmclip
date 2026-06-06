import { useState, useRef, useEffect } from 'react'
import { Mic, Loader2, CheckCircle2, AlertCircle, X, AlertTriangle } from 'lucide-react'
import {
  createWhisperWorker,
  extractAudioForWhisper,
  getBestCachedModel,
  WHISPER_MODELS,
  WHISPER_LANGUAGES,
  type WhisperModelId,
  type WhisperStatus,
  type TranscriptResult,
} from '../lib/whisper'
import { writeCapabilityHint, recordToolUsage } from '../lib/projectSession'
import {
  startWarmingQueue,
  subscribeWarmingStatus,
  unsubscribeWarmingStatus,
  getWarmingStatus,
  type WarmingStatus,
} from '../lib/modelWarmer'

const LANG_PREF_KEY  = 'calmclip_lang_pref'
const MODEL_PREF_KEY = 'calmclip_model_pref'

function loadLangPref(): string {
  try { return localStorage.getItem(LANG_PREF_KEY) ?? 'auto' } catch { return 'auto' }
}

function saveLangPref(code: string): void {
  try { localStorage.setItem(LANG_PREF_KEY, code) } catch { /* ignore */ }
}

function loadModelPref(): WhisperModelId {
  try {
    const stored = localStorage.getItem(MODEL_PREF_KEY)
    const valid: WhisperModelId[] = ['Xenova/whisper-tiny', 'Xenova/whisper-base', 'Xenova/whisper-small', 'Xenova/whisper-medium']
    if (stored && (valid as string[]).includes(stored)) return stored as WhisperModelId
  } catch { /* ignore */ }
  return 'Xenova/whisper-base'
}

function saveModelPref(id: WhisperModelId): void {
  try { localStorage.setItem(MODEL_PREF_KEY, id) } catch { /* ignore */ }
}

interface Props {
  file:       File | null
  trimStart:  number
  trimEnd:    number
  hasAudio:   boolean
  onResult:   (result: TranscriptResult) => void
  onCaption:  (text: string) => void
}

const TRANSCRIBE_TIPS = [
  'Your video and audio never leave your device. Zero uploads, zero servers.',
  'CalmClip runs Whisper speech recognition fully locally in your browser.',
  'Drag the caption text on the preview to reposition it anywhere.',
  'Silence cutter removes dead air and long pauses automatically.',
  'Batch export produces 16:9, 9:16, 1:1 and 4:3 files in one click.',
  'Face blur runs fully on-device using AI. No cloud processing.',
  'Filler word removal can clean up "um", "uh" and similar words.',
  'CalmClip works offline once loaded. No internet needed to export.',
  'Audio denoise reduces background hum and room noise at export.',
  'The karaoke caption style highlights each spoken word as it plays.',
  'You can trim the in and out points precisely using the trim handles.',
]

export default function WhisperPanel({ file, trimStart, trimEnd, hasAudio, onResult, onCaption }: Props) {
  const [status, setStatus]       = useState<WhisperStatus>({ phase: 'idle' })
  const [elapsed, setElapsed]     = useState(0)
  const [modelId, setModelId]     = useState<WhisperModelId>(loadModelPref)
  const [language, setLanguage]       = useState<string>(loadLangPref)
  const [warmingStatus, setWarmingStatus] = useState<WarmingStatus | null>(getWarmingStatus)
  const workerRef                     = useRef<ReturnType<typeof createWhisperWorker> | null>(null)
  const elapsedIntervalRef        = useRef<number | null>(null)
  const transcribeStartRef        = useRef<number>(0)
  const lastPhaseRef              = useRef<WhisperStatus['phase']>('idle')
  const lastDownloadProgressRef   = useRef<number>(0)

  const [tipIdx, setTipIdx]       = useState(0)
  const [tipVisible, setTipVisible] = useState(true)

  const busy = status.phase === 'extracting-audio' || status.phase === 'loading-model' || status.phase === 'transcribing'

  useEffect(() => {
    if (!busy) return
    setTipIdx(0)
    setTipVisible(true)
    const cycle = setInterval(() => {
      setTipVisible(false)
      setTimeout(() => {
        setTipIdx(i => (i + 1) % TRANSCRIBE_TIPS.length)
        setTipVisible(true)
      }, 350)
    }, 4500)
    return () => clearInterval(cycle)
  }, [busy])

  useEffect(() => {
    setStatus({ phase: 'idle' })
  }, [file])

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      if (elapsedIntervalRef.current !== null) clearInterval(elapsedIntervalRef.current)
    }
  }, [])

  // Subscribe to background warming status for the pill UI (Phase 3)
  useEffect(() => {
    subscribeWarmingStatus(setWarmingStatus)
    return () => unsubscribeWarmingStatus(setWarmingStatus)
  }, [])

  // Auto-upgrade to the best already-cached model on mount (Phase 3).
  // Only promotes from the default (base). A user who explicitly chose tiny
  // for speed keeps their preference; we do not override a deliberate choice.
  useEffect(() => {
    getBestCachedModel().then(best => {
      if (best !== 'Xenova/whisper-base') {
        setModelId(prev => {
          if (prev === 'Xenova/whisper-base') {
            saveModelPref(best)
            return best
          }
          return prev
        })
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (status.phase === 'transcribing') {
      if (elapsedIntervalRef.current === null) {
        transcribeStartRef.current = Date.now()
        setElapsed(0)
        elapsedIntervalRef.current = window.setInterval(() => {
          setElapsed(Math.round((Date.now() - transcribeStartRef.current) / 1000))
        }, 1000)
      }
    } else {
      if (elapsedIntervalRef.current !== null) {
        clearInterval(elapsedIntervalRef.current)
        elapsedIntervalRef.current = null
      }
    }
  }, [status.phase])

  async function handleRun() {
    if (!file) return

    const trimDuration = trimEnd - trimStart
    if (trimDuration > 3600) {
      setStatus({
        phase: 'error',
        message: `This clip is ${Math.round(trimDuration / 60)} minutes long. In-browser transcription may exhaust browser memory on clips over 60 minutes. Trim to a shorter segment before transcribing.`,
      })
      return
    }

    setStatus({ phase: 'extracting-audio' })
    recordToolUsage('transcribe').catch(() => {})
    try {
      const audio = await extractAudioForWhisper(file, trimStart, trimEnd)
      if (!workerRef.current) {
        workerRef.current = createWhisperWorker(s => {
          if (s.phase !== 'error') {
            lastPhaseRef.current = s.phase
            if (s.phase === 'loading-model') {
              lastDownloadProgressRef.current = s.progress
            }
          }
          setStatus(s)
          if (s.phase === 'error') {
            workerRef.current?.terminate()
            workerRef.current = null
          }
          if (s.phase === 'done') {
            onResult(s.result)
            if (!s.result.text) {
              setStatus({ phase: 'error', message: 'No speech was detected in this clip. Make sure the audio track contains audible speech and try again.' })
              return
            }
            const full = s.result.text.trim().replace(/\s+/g, ' ').slice(0, 80)
            if (full) onCaption(full)
            // Phase 2: write language hint for future routing
            if (s.detectedLanguage) {
              writeCapabilityHint(s.detectedLanguage, modelId).catch(() => {})
            }
            // Phase 3: start background model warming
            startWarmingQueue(modelId).catch(() => {})
          }
        })
      }
      workerRef.current.run(audio, modelId, language === 'auto' ? undefined : language)
    } catch (e) {
      setStatus({ phase: 'error', message: e instanceof Error ? e.message : 'Audio extraction failed.' })
    }
  }

  function handleCancel() {
    workerRef.current?.terminate()
    workerRef.current = null
    setStatus({ phase: 'idle' })
  }

  function fmtElapsed(s: number): string {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }

  function fmtTime(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const blocked = !file || !hasAudio
  const selectedModel = WHISPER_MODELS.find(m => m.id === modelId) ?? WHISPER_MODELS[0]

  if (!hasAudio && file) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        No audio track detected in this video. Transcription is not available.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">

      {!busy && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-1">
            {WHISPER_MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => {
                  setModelId(m.id)
                  saveModelPref(m.id)
                  if (workerRef.current) {
                    workerRef.current.terminate()
                    workerRef.current = null
                  }
                  if (status.phase === 'done' || status.phase === 'error') {
                    setStatus({ phase: 'idle' })
                  }
                }}
                className="flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg text-xs transition-all"
                style={{
                  background: modelId === m.id ? 'var(--primary-a10)' : 'var(--bg-surface)',
                  border:     `1px solid ${modelId === m.id ? 'var(--primary)' : 'var(--border)'}`,
                  color:      modelId === m.id ? 'var(--primary)' : 'var(--text-faint)',
                  cursor:     'pointer',
                }}
              >
                <span className="font-medium">{m.label}</span>
                <span style={{ fontSize: 9, opacity: 0.7 }}>{m.size}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="whisper-lang"
              style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}
            >
              Language
            </label>
            <select
              id="whisper-lang"
              value={language}
              onChange={e => {
                setLanguage(e.target.value)
                saveLangPref(e.target.value)
                if (workerRef.current) {
                  workerRef.current.terminate()
                  workerRef.current = null
                }
                if (status.phase === 'done' || status.phase === 'error') {
                  setStatus({ phase: 'idle' })
                }
              }}
              style={{
                width:           '100%',
                height:          32,
                padding:         '0 8px',
                borderRadius:    6,
                border:          '1px solid var(--border)',
                background:      'var(--bg-surface)',
                color:           'var(--text-muted)',
                fontSize:        13,
                cursor:          'pointer',
                outline:         'none',
                appearance:      'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='rgba(255,255,255,0.35)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat:   'no-repeat',
                backgroundPosition: 'right 8px center',
                paddingRight:       28,
              }}
            >
              {WHISPER_LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <div
            className="rounded px-2 py-2 text-xs flex flex-col gap-1"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                {selectedModel.label} model
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-xs"
                style={{ background: 'var(--primary-a10)', color: 'var(--primary)', fontSize: 10 }}
              >
                {selectedModel.speed}
              </span>
            </div>
            <p style={{ color: 'var(--text-faint)', lineHeight: 1.45 }}>
              {selectedModel.description}
            </p>
            {selectedModel.warning && (
              <div className="flex items-start gap-1.5 mt-0.5" style={{ color: '#f59e0b' }}>
                <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />
                <span style={{ fontSize: 10, lineHeight: 1.4 }}>{selectedModel.warning}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleRun}
          disabled={busy || blocked}
          className={`flex items-center justify-center gap-2 text-sm px-3 py-2 rounded-lg transition-all flex-1 font-semibold ${
            busy
              ? ''
              : blocked
              ? ''
              : 'active:scale-[0.98]'
          }`}
          style={{
            background: busy
              ? 'var(--primary-a8)'
              : blocked
              ? 'var(--bg-surface)'
              : 'var(--primary)',
            border: `1px solid ${busy ? 'var(--primary)' : blocked ? 'var(--border)' : 'var(--primary)'}`,
            color: busy
              ? 'var(--primary)'
              : blocked
              ? 'var(--text-faint)'
              : '#fff',
            cursor: busy || blocked ? 'default' : 'pointer',
          }}
        >
          {busy
            ? <Loader2 size={13} className="animate-spin" />
            : status.phase === 'done'
            ? <CheckCircle2 size={13} color="#10b981" />
            : <Mic size={13} />
          }
          {status.phase === 'idle'             && 'Generate caption from speech'}
          {status.phase === 'extracting-audio' && 'Extracting audio...'}
          {status.phase === 'loading-model'    && `Loading ${selectedModel.label} model...`}
          {status.phase === 'transcribing'     && 'Transcribing...'}
          {status.phase === 'done'             && 'Done, click to run again'}
          {status.phase === 'error'            && 'Retry transcription'}
        </button>

        {(status.phase === 'transcribing' || status.phase === 'extracting-audio' || status.phase === 'loading-model') && (
          <button
            onClick={handleCancel}
            title="Cancel"
            className="flex items-center justify-center rounded-lg transition-all"
            style={{
              width:      36,
              flexShrink: 0,
              background: 'rgba(239,68,68,0.08)',
              border:     '1px solid rgba(239,68,68,0.3)',
              color:      '#ef4444',
              cursor:     'pointer',
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {status.phase === 'loading-model' && (
        <div className="pl-1">
          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-faint)' }}>
            <span>Downloading {selectedModel.label} model (one-time, {selectedModel.size})</span>
            <span>{status.progress}%</span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 4, background: 'var(--border)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${status.progress}%`, background: 'var(--primary)', transition: 'width 0.2s ease' }}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Cached after first download. No audio leaves your device.</p>
          <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#f59e0b' }}>
            <AlertTriangle size={9} style={{ flexShrink: 0 }} />
            Keep this tab active until the download completes.
          </p>
        </div>
      )}

      {status.phase === 'transcribing' && (() => {
        const CHUNK_LENGTH_S  = 30
        const STRIDE_LENGTH_S = 5
        const STEP_S          = CHUNK_LENGTH_S - STRIDE_LENGTH_S

        const PROCESSING_RATIO = 2.0
        const expectedSec      = status.durationSec > 0 ? status.durationSec * PROCESSING_RATIO : 120
        const mainThreadPct    = Math.min(95, Math.round((elapsed / expectedSec) * 100))
        const displayPct       = Math.max(status.progress, mainThreadPct)

        const totalChunks   = status.durationSec > 0 ? Math.max(1, Math.ceil(status.durationSec / STEP_S)) : 0
        const currentChunk  = totalChunks > 0 ? Math.min(totalChunks, Math.floor((displayPct / 100) * totalChunks) + 1) : 0
        const segStartSec   = (currentChunk - 1) * STEP_S
        const segEndSec     = Math.min(status.durationSec, segStartSec + CHUNK_LENGTH_S)

        return (
          <div className="pl-1">
            <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-faint)' }}>
              <span className="flex items-center gap-1.5">
                Transcribing
                {status.durationSec > 0 && ` ${Math.round(status.durationSec)}s of audio`}
                {elapsed > 0 && <span style={{ color: 'var(--text-faint)' }}>, {fmtElapsed(elapsed)} elapsed</span>}
                {status.backend && (
                  <span
                    style={{
                      fontSize:     9,
                      padding:      '1px 5px',
                      borderRadius: 4,
                      fontWeight:   600,
                      letterSpacing: '0.06em',
                      background:   status.backend === 'webgpu' ? 'var(--primary-a10)' : 'var(--bg-surface)',
                      color:        status.backend === 'webgpu' ? 'var(--primary)' : 'var(--text-faint)',
                      border:       `1px solid ${status.backend === 'webgpu' ? 'var(--primary-a20)' : 'var(--border)'}`,
                    }}
                  >
                    {status.backend === 'webgpu' ? 'GPU' : 'CPU'}
                  </span>
                )}
              </span>
              <span>{displayPct}%</span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 4, background: 'var(--border)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${displayPct}%`, background: 'var(--primary)', transition: 'width 0.4s ease' }}
              />
            </div>
            {totalChunks > 0 && (
              <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
                <span
                  className="inline-block rounded-sm px-1 py-0.5 font-mono"
                  style={{ background: 'var(--primary-a10)', color: 'var(--primary)', fontSize: 10 }}
                >
                  {currentChunk}/{totalChunks}
                </span>
                <span>
                  segment {fmtTime(segStartSec)}--{fmtTime(segEndSec)}
                  {totalChunks === 1 ? ' - single pass' : ''}
                </span>
              </p>
            )}
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>No audio leaves your device. This may take a few minutes for longer clips.</p>
          </div>
        )
      })()}

      {status.phase === 'error' && (
        <div className="flex items-start gap-2 text-xs p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
          <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
          {lastPhaseRef.current === 'loading-model'
            ? `Download interrupted at ${lastDownloadProgressRef.current}%. Already downloaded files are saved. Click retry and it will finish quickly.`
            : status.message}
        </div>
      )}

      {status.phase === 'idle' && (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          Runs locally in your browser. No audio is sent anywhere.
        </p>
      )}

      {status.phase === 'done' && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#10b981' }}>
            <Mic size={11} />
            Caption filled from transcript. Edit it above if needed.
          </div>
          {status.detectedLanguage && language === 'auto' && (
            <div className="text-xs" style={{ color: 'var(--text-faint)' }}>
              Detected language: <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{status.detectedLanguage}</span>
            </div>
          )}
        </div>
      )}

      {busy && (
        <div
          className="mt-1 p-3 rounded-lg flex flex-col gap-1.5"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            minHeight: 56,
          }}
        >
          <p className="text-xs" style={{ color: 'var(--text-faint)', letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 9, fontWeight: 600, margin: 0 }}>Did you know</p>
          <p
            className="text-xs"
            style={{
              color:      'var(--text-dim)',
              opacity:    tipVisible ? 1 : 0,
              transition: 'opacity 0.35s ease',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {TRANSCRIBE_TIPS[tipIdx]}
          </p>
        </div>
      )}

      {warmingStatus && (
        <button
          onClick={() => setWarmingStatus(null)}
          title="Click to dismiss"
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            8,
            padding:        '7px 10px',
            borderRadius:   8,
            background:     'var(--bg-surface)',
            border:         '1px solid var(--border)',
            cursor:         'pointer',
            width:          '100%',
            textAlign:      'left',
          }}
        >
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--border-subtle, var(--border))', overflow: 'hidden' }}>
            <div
              style={{
                height:     '100%',
                width:      `${warmingStatus.progress}%`,
                background: 'var(--primary)',
                borderRadius: 2,
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {warmingStatus.done
              ? `Whisper ${warmingStatus.modelLabel} cached`
              : `Upgrading accuracy... ${warmingStatus.progress}%`}
          </span>
        </button>
      )}
    </div>
  )
}
