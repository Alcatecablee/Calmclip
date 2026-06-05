import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, CheckCircle2, Wand2 } from 'lucide-react'
import { extractAudioFromVideo } from '@/lib/audioExtractor'
import { transcribeToTimedWords } from '@/lib/whisperTranscribe'
import type { Word } from '@/lib/captionEngine'

const PHASES = {
  idle:        'idle',
  extracting:  'extracting',
  downloading: 'downloading',
  loading:     'loading',
  transcribing:'transcribing',
  done:        'done',
  error:       'error',
} as const

type Phase = typeof PHASES[keyof typeof PHASES]


interface Props {
  videoFile: File | null
  videoDuration: number
  onTranscribed: (words: Word[]) => void
}

// Map each status message to an overall 0-100 percentage across all phases:
//   extracting  0-12%
//   downloading 12-72%  (scaled from model download %)
//   loading     72-82%
//   transcribing 82-99% (scaled from inference %)
//   done        100%
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

export default function TranscribeButton({ videoFile, videoDuration, onTranscribed }: Props) {
  const [phase, setPhase] = useState<Phase>(PHASES.idle)
  const [, setStatus] = useState('')
  const [overallPct, setOverallPct] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleTranscribe = async () => {
    if (!videoFile) {
      setError('No video file available for transcription.')
      return
    }

    setPhase(PHASES.extracting)
    setOverallPct(4)
    setError(null)
    setStatus('')

    let audioBlob: Blob
    try {
      audioBlob = await extractAudioFromVideo(videoFile)
    } catch (e) {
      setPhase(PHASES.error)
      setError('Failed to extract audio: ' + (e as Error).message)
      return
    }

    setPhase(PHASES.downloading)
    setOverallPct(12)

    let words: Word[]
    try {
      const result = await transcribeToTimedWords(
        audioBlob,
        videoDuration || 60,
        (msg) => {
          setStatus(msg)
          const pct = computeOverallPct(msg)
          if (pct !== null) setOverallPct(pct)
          if (msg.startsWith('Downloading model')) {
            setPhase(PHASES.downloading)
          } else if (msg.startsWith('Loading Whisper') || msg.startsWith('Model ready')) {
            setPhase(PHASES.loading)
          } else if (msg.startsWith('Transcribing')) {
            setPhase(PHASES.transcribing)
          } else if (msg === 'Done') {
            setPhase(PHASES.done)
          }
        },
      )
      words = result.words
    } catch (e) {
      setPhase(PHASES.error)
      setError('Transcription failed: ' + (e as Error).message)
      return
    }

    setOverallPct(100)
    setPhase(PHASES.done)
    onTranscribed(words)
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

  const isProcessing = phase !== PHASES.idle && phase !== PHASES.done && phase !== PHASES.error

  const stepLabels: Record<Phase, string> = {
    [PHASES.idle]:        '',
    [PHASES.extracting]:  'Extracting audio...',
    [PHASES.downloading]: 'Downloading processing engine',
    [PHASES.loading]:     'Preparing model...',
    [PHASES.transcribing]:'Transcribing...',
    [PHASES.done]:        'Transcription complete',
    [PHASES.error]:       'Error',
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleTranscribe}
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
      </Button>

      {isProcessing && (
        <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Loader2 className="w-3 h-3 animate-spin shrink-0" />
              <span>{stepLabels[phase]}</span>
            </div>
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--primary)' }}>
              {overallPct}%
            </span>
          </div>

          {phase === PHASES.downloading && (
            <p className="mt-1 text-[10px]" style={{ color: 'var(--text-faint)' }}>
              One-time download (~37 MB). After this, the app works fully offline.
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
    </div>
  )
}
