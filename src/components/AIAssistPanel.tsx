import { useState, useEffect, useRef } from 'react'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import type { TranscriptResult } from '../lib/whisper'

interface Props {
  transcript: TranscriptResult
}

type AIAvailability = 'checking' | 'none' | 'language-model' | 'summarizer'
type AIAction = 'titles' | 'social' | 'keypoints'

interface AIResult {
  action: AIAction
  text:   string
}

const AVAIL_POSITIVE = new Set(['available', 'readily', 'after-download', 'downloadable'])

export default function AIAssistPanel({ transcript }: Props) {
  const [availability,   setAvailability]   = useState<AIAvailability>('checking')
  const [busyAction,     setBusyAction]     = useState<AIAction | null>(null)
  const [result,         setResult]         = useState<AIResult | null>(null)
  const [error,          setError]          = useState<string | null>(null)
  const [needsDownload,  setNeedsDownload]  = useState(false)

  const lmRef  = useRef<unknown>(null)
  const sumRef = useRef<unknown>(null)

  useEffect(() => {
    let cancelled = false
    async function detect() {
      const win   = window as unknown as Record<string, unknown>
      const aiNs  = win.ai as Record<string, unknown> | undefined

      const lmObj = win.LanguageModel ?? aiNs?.languageModel
      if (lmObj && typeof (lmObj as { availability?: unknown }).availability === 'function') {
        try {
          const avail = await (lmObj as { availability(): Promise<string> }).availability()
          if (!cancelled && AVAIL_POSITIVE.has(avail)) {
            lmRef.current = lmObj
            setNeedsDownload(avail === 'after-download' || avail === 'downloadable')
            setAvailability('language-model')
            return
          }
        } catch { /* not available on this browser */ }
      }

      const sumObj = win.Summarizer ?? aiNs?.summarizer
      if (sumObj && typeof (sumObj as { availability?: unknown }).availability === 'function') {
        try {
          const avail = await (sumObj as { availability(): Promise<string> }).availability()
          if (!cancelled && AVAIL_POSITIVE.has(avail)) {
            sumRef.current = sumObj
            setNeedsDownload(avail === 'after-download' || avail === 'downloadable')
            setAvailability('summarizer')
            return
          }
        } catch { /* not available on this browser */ }
      }

      if (!cancelled) setAvailability('none')
    }
    detect()
    return () => { cancelled = true }
  }, [])

  if (availability === 'checking' || availability === 'none') return null

  const transcriptText = transcript.text.trim().slice(0, 3000)
  if (!transcriptText) return null

  async function runAction(action: AIAction) {
    setBusyAction(action)
    setResult(null)
    setError(null)
    try {
      let output = ''
      const signal = AbortSignal.timeout(30_000)

      if (availability === 'language-model') {
        type LMSession = { prompt(p: string, opts?: { signal?: AbortSignal }): Promise<string>; destroy(): void }
        type LM = { create(opts: { systemPrompt: string; signal?: AbortSignal }): Promise<LMSession> }
        const lm = lmRef.current as LM
        let systemPrompt = ''
        let userPrompt   = ''

        if (action === 'titles') {
          systemPrompt = 'You are a video title expert for YouTube and TikTok. Be concise and compelling. Return only the numbered list, no preamble.'
          userPrompt   = `Generate 3 short, catchy video titles for a video with this transcript:\n\n${transcriptText}\n\nFormat:\n1. ...\n2. ...\n3. ...`
        } else if (action === 'social') {
          systemPrompt = 'You are a social media copywriter. Write short, punchy captions under 200 characters, with 2 to 3 relevant hashtags.'
          userPrompt   = `Write a social media caption for a video with this transcript:\n\n${transcriptText}`
        } else {
          systemPrompt = 'You extract key points from video transcripts. Be concise.'
          userPrompt   = `List 3 to 5 key points from this transcript:\n\n${transcriptText}`
        }

        const session = await lm.create({ systemPrompt, signal })
        try {
          output = (await session.prompt(userPrompt, { signal })).trim()
        } finally {
          session.destroy()
        }

      } else {
        type Summarizer = { summarize(text: string, opts?: { signal?: AbortSignal }): Promise<string>; destroy?(): void }
        type SummarizerFactory = { create(opts: Record<string, unknown>): Promise<Summarizer> }
        const factory = sumRef.current as SummarizerFactory

        if (action === 'titles') {
          const s = await factory.create({ type: 'headline', format: 'plain-text', length: 'short', signal })
          try { output = (await s.summarize(transcriptText, { signal })).trim() } finally { s.destroy?.() }
        } else if (action === 'social') {
          const s = await factory.create({ type: 'tldr', format: 'plain-text', length: 'short', signal })
          try { output = (await s.summarize(transcriptText, { signal })).trim() } finally { s.destroy?.() }
        } else {
          const s = await factory.create({ type: 'key-points', format: 'plain-text', length: 'medium', signal })
          try { output = (await s.summarize(transcriptText, { signal })).trim() } finally { s.destroy?.() }
        }
      }

      setResult({ action, text: output })
    } catch (e) {
      const isTimeout = e instanceof DOMException && e.name === 'TimeoutError'
      setError(isTimeout
        ? 'Timed out after 30 seconds. Gemini Nano may still be downloading. Keep the tab open and try again shortly.'
        : (e instanceof Error ? e.message : 'AI request failed.')
      )
    } finally {
      setBusyAction(null)
    }
  }

  const actions: { id: AIAction; label: string }[] = [
    { id: 'titles',    label: 'Suggest titles'   },
    { id: 'social',    label: 'Social caption'   },
    { id: 'keypoints', label: 'Key points'       },
  ]

  const resultLabels: Record<AIAction, string> = {
    titles:    'Title suggestions',
    social:    'Social caption',
    keypoints: 'Key points',
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <Sparkles size={11} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
          Chrome built-in AI (Gemini Nano, on-device)
        </span>
      </div>

      {needsDownload && (
        <p className="text-xs" style={{ color: '#f59e0b' }}>
          Gemini Nano will download on first use (one-time, a few hundred MB). Keep the tab open until it finishes.
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {actions.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => runAction(id)}
            disabled={busyAction !== null}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded"
            style={{
              background: 'var(--bg-surface)',
              border:     '1px solid var(--border)',
              color:      busyAction !== null ? 'var(--text-faint)' : 'var(--text-muted)',
              cursor:     busyAction !== null ? 'default' : 'pointer',
            }}
          >
            {busyAction === id
              ? <Loader2 size={10} className="animate-spin" style={{ color: 'var(--primary)' }} />
              : <Sparkles size={10} />
            }
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="flex items-start gap-1.5 text-xs p-2 rounded"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
        >
          <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div
          className="flex flex-col gap-2 text-xs p-3 rounded"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <span style={{
            fontSize: 10, color: 'var(--text-faint)',
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
          }}>
            {resultLabels[result.action]}
          </span>
          <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
            {result.text}
          </p>
        </div>
      )}
    </div>
  )
}
