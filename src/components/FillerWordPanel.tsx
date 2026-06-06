import { useState, useMemo } from 'react'
import { Scissors, ChevronDown, ChevronUp } from 'lucide-react'
import { detectFillerWords, FILLER_WORDS_BY_LANGUAGE, type TranscriptResult, type TranscriptChunk } from '../lib/whisper'

interface Props {
  transcript:      TranscriptResult
  removedFillers:  TranscriptChunk[]
  onToggle:        (chunks: TranscriptChunk[]) => void
  language?:       string
  onProGate?:      () => void
}

export default function FillerWordPanel({ transcript, removedFillers, onToggle, language, onProGate }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [detectError, setDetectError] = useState<string | null>(null)
  const found = useMemo(() => {
    try {
      setDetectError(null)
      return detectFillerWords(transcript.chunks, language)
    } catch (err) {
      setDetectError(err instanceof Error ? err.message : String(err))
      return [] as TranscriptChunk[]
    }
  }, [transcript.chunks, language])

  if (detectError) {
    return (
      <p className="text-xs" style={{ color: '#ef4444' }}>
        Filler word detection error: {detectError}
      </p>
    )
  }

  if (found.length === 0) {
    return (
      <p className="text-xs" style={{ color: '#10b981' }}>
        No filler words detected in transcript.
      </p>
    )
  }

  const allRemoved = removedFillers.length === found.length

  function fmt(s: number): string {
    const m  = Math.floor(s / 60)
    const ss = (s % 60).toFixed(1).padStart(4, '0')
    return `${m}:${ss}`
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: '#f59e0b' }}>
          {found.length} filler {found.length === 1 ? 'word' : 'words'} found
        </span>
        <button
          onClick={() => setExpanded(x => !x)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)' }}
          title={expanded ? 'Collapse list' : 'Show detected filler words'}
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {expanded && (
        <div
          className="rounded-lg p-2 flex flex-col gap-1"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', maxHeight: 120, overflowY: 'auto' }}
        >
          {found.map((c, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>"{(c.text ?? '').trim()}"</span>
              <span style={{ color: 'var(--text-faint)' }}>{c.timestamp[0] != null ? fmt(c.timestamp[0]) : ''}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Detected: {(FILLER_WORDS_BY_LANGUAGE[language ?? 'english'] ?? FILLER_WORDS_BY_LANGUAGE['english']).slice(0, 5).join(', ')} and more.
      </p>

      <button
        onClick={() => { if (onProGate && !allRemoved) { onProGate(); return } onToggle(allRemoved ? [] : found) }}
        className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-all"
        style={{
          background: allRemoved ? 'var(--primary-a10)' : 'var(--bg-surface)',
          border:     `1px solid ${allRemoved ? 'var(--primary)' : 'var(--border)'}`,
          color:      allRemoved ? 'var(--primary)' : 'var(--text-faint)',
          cursor:     'pointer',
        }}
        title="Cut every detected filler word out of the video at export time"
      >
        <Scissors size={11} />
        {allRemoved ? `Remove all ${found.length} filler words at export (on)` : `Remove all ${found.length} filler words at export`}
        {onProGate && !allRemoved && <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', background: 'var(--primary-a10)', color: 'var(--primary)', borderRadius: 3, padding: '1px 5px' }}>PRO</span>}
      </button>

      {allRemoved && (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          Cuts applied at export. Preview shows original timing.
        </p>
      )}
    </div>
  )
}
