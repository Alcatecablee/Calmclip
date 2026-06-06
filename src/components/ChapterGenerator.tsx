import { useState, useMemo } from 'react'
import { Copy, Check } from 'lucide-react'
import type { TranscriptResult } from '../lib/whisper'
import { detectChapters, dedupeChapters, type Chapter } from '../lib/chapterGenerator'

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

interface Props {
  transcript:  TranscriptResult
  onProGate?:  () => void
}

export default function ChapterGenerator({ transcript, onProGate }: Props) {
  const [copied, setCopied] = useState(false)
  const [clipboardError, setClipboardError] = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [customChapters, setCustomChapters] = useState<Chapter[] | null>(null)

  const [detectError, setDetectError] = useState<string | null>(null)
  const detected = useMemo(() => {
    try {
      setDetectError(null)
      return dedupeChapters(detectChapters(transcript))
    } catch (err) {
      setDetectError(err instanceof Error ? err.message : String(err))
      return [] as Chapter[]
    }
  }, [transcript])

  const chapters = customChapters ?? detected

  function copyToClipboard() {
    const text = chapters.map(c => `${fmt(c.start)} ${c.title}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setClipboardError(false)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      setClipboardError(true)
      setTimeout(() => setClipboardError(false), 3000)
    })
  }

  function startEdit(idx: number) {
    setEditingIdx(idx)
    setEditValue(chapters[idx].title)
  }

  function commitEdit(idx: number) {
    const updated = chapters.map((c, i) => i === idx ? { ...c, title: editValue.trim() || c.title } : c)
    setCustomChapters(updated)
    setEditingIdx(null)
  }

  function removeChapter(idx: number) {
    if (chapters.length <= 1) return
    setCustomChapters(chapters.filter((_, i) => i !== idx))
  }

  if (detectError) {
    return (
      <p className="text-xs" style={{ color: '#ef4444' }}>
        Chapter generator error: {detectError}
      </p>
    )
  }

  if (chapters.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Not enough transcript data to detect chapters. Transcribe more of the video first.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} detected. Click a title to rename, or copy for YouTube.
      </p>

      <div
        className="flex flex-col rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        {chapters.map((ch, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-2"
            style={{
              borderBottom: i < chapters.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                color: 'var(--primary)',
                minWidth: 36,
                flexShrink: 0,
              }}
            >
              {fmt(ch.start)}
            </span>

            {editingIdx === i ? (
              <input
                autoFocus
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => commitEdit(i)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit(i)
                  if (e.key === 'Escape') setEditingIdx(null)
                }}
                className="flex-1 text-xs outline-none rounded px-1"
                style={{
                  background: 'var(--primary-a10)',
                  border: '1px solid var(--primary)',
                  color: 'var(--text-primary)',
                  padding: '2px 6px',
                }}
              />
            ) : (
              <span
                className="flex-1 text-xs cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => startEdit(i)}
                title="Click to rename"
              >
                {ch.title}
              </span>
            )}

            {chapters.length > 1 && (
              <button
                onClick={() => removeChapter(i)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  color: 'var(--text-faint)',
                  fontSize: 13,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                title="Remove chapter"
              >
                x
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => { if (onProGate) { onProGate(); return } copyToClipboard() }}
        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-medium transition-all"
        style={{
          background: copied ? 'rgba(74,222,128,0.08)' : clipboardError ? 'rgba(239,68,68,0.08)' : 'var(--primary-a10)',
          border:     `1px solid ${copied ? 'rgba(74,222,128,0.3)' : clipboardError ? 'rgba(239,68,68,0.3)' : 'var(--primary-a20)'}`,
          color:      copied ? '#4ade80' : clipboardError ? '#ef4444' : 'var(--primary)',
          cursor:     'pointer',
        }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Copied to clipboard' : clipboardError ? 'Copy failed: select the text above manually' : 'Copy for YouTube description'}
        {onProGate && !copied && <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', background: 'rgba(255,255,255,0.15)', borderRadius: 3, padding: '1px 5px' }}>PRO</span>}
      </button>
    </div>
  )
}
