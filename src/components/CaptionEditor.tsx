import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Clock, GripVertical } from 'lucide-react'
import type { Word } from '@/lib/captionEngine'

interface Props {
  words: Word[]
  onWordsChange: (words: Word[]) => void
  videoDuration?: number
}

export default function CaptionEditor({ words, onWordsChange, videoDuration: _videoDuration }: Props) {
  const [editMode, setEditMode] = useState<'transcript' | 'timeline'>('transcript')
  const [draftText, setDraftText] = useState<string | null>(null) // null = use words as source of truth

  // When words change externally (e.g. after transcription), clear draft
  const prevWordsRef = useRef(words)
  if (prevWordsRef.current !== words) {
    prevWordsRef.current = words
    // Only reset draft if it was from the previous word set
    if (draftText !== null) setDraftText(null)
  }

  const handleTranscriptChange = (text: string) => {
    setDraftText(text)
  }

  const handleTranscriptBlur = () => {
    if (draftText === null) return
    const text = draftText
    setDraftText(null)
    if (!words || words.length === 0) {
      // Bootstrap timing from scratch: 0.5 second per word
      const newWords = text.trim().split(/\s+/).filter(Boolean)
      const updated = newWords.map((w, i) => ({
        text: w,
        startTime: i * 0.5,
        endTime: (i + 1) * 0.5,
      }))
      onWordsChange(updated)
      return
    }
    const startTime = words[0].startTime
    const endTime = words[words.length - 1].endTime
    const newWords = text.trim().split(/\s+/).filter(Boolean)
    if (newWords.length === 0) return
    const duration = endTime - startTime
    const wordDur = duration / newWords.length
    const updated = newWords.map((w, i) => ({
      text: w,
      startTime: startTime + i * wordDur,
      endTime: startTime + (i + 1) * wordDur,
    }))
    onWordsChange(updated)
  }

  const handleWordEdit = (index: number, field: keyof Word, value: string) => {
    const updated = [...words]
    if (field === 'text') {
      updated[index] = { ...updated[index], text: value }
    } else {
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 }
    }
    onWordsChange(updated)
  }

  const removeWord = (index: number) => {
    const updated = words.filter((_, i) => i !== index)
    onWordsChange(updated)
  }

  const addWord = () => {
    const lastWord = words[words.length - 1]
    const newStart = lastWord ? lastWord.endTime : 0
    onWordsChange([...words, { text: 'word', startTime: newStart, endTime: newStart + 0.5 }])
  }

  const transcriptText = draftText !== null ? draftText : words.map(w => w.text).join(' ')

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <button
          onClick={() => setEditMode('transcript')}
          className="flex-1 text-xs py-1.5 rounded-md font-medium transition-colors"
          style={{
            background: editMode === 'transcript' ? 'var(--bg-page)' : 'transparent',
            color: editMode === 'transcript' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: editMode === 'transcript' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Transcript
        </button>
        <button
          onClick={() => setEditMode('timeline')}
          className="flex-1 text-xs py-1.5 rounded-md font-medium transition-colors"
          style={{
            background: editMode === 'timeline' ? 'var(--bg-page)' : 'transparent',
            color: editMode === 'timeline' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: editMode === 'timeline' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Timeline
        </button>
      </div>

      {editMode === 'transcript' ? (
        <div>
          <Textarea
            value={transcriptText}
            onChange={(e) => handleTranscriptChange(e.target.value)}
            onBlur={handleTranscriptBlur}
            placeholder="Type or paste your transcript here..."
            className="min-h-[120px] text-sm resize-none"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          />
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-faint)' }}>
            {words.length} words · Click away to apply timing.
          </p>
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
          {words.map((word, i) => (
            <div key={i} className="flex items-center gap-1.5 group">
              <GripVertical className="w-3 h-3" style={{ color: 'var(--text-faint)', opacity: 0.4 }} />
              <Input
                value={word.text}
                onChange={(e) => handleWordEdit(i, 'text', e.target.value)}
                className="h-7 text-xs flex-1"
                style={{ background: 'var(--bg-surface)' }}
              />
              <div className="flex items-center gap-1 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                <Clock className="w-2.5 h-2.5" />
                <input
                  type="number"
                  value={word.startTime.toFixed(2)}
                  onChange={(e) => handleWordEdit(i, 'startTime', e.target.value)}
                  className="w-14 rounded px-1 py-0.5 text-center text-[10px]"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  step="0.1"
                />
                <span>-</span>
                <input
                  type="number"
                  value={word.endTime.toFixed(2)}
                  onChange={(e) => handleWordEdit(i, 'endTime', e.target.value)}
                  className="w-14 rounded px-1 py-0.5 text-center text-[10px]"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  step="0.1"
                />
              </div>
              <button
                onClick={() => removeWord(i)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={addWord}
            className="w-full h-7 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <Plus className="w-3 h-3 mr-1" /> Add Word
          </Button>
        </div>
      )}
    </div>
  )
}
