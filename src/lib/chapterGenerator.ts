import type { TranscriptResult } from './whisper'

export interface Chapter {
  start: number
  title: string
}

const TRANSITION_PHRASES = [
  "now let's", "now let me", "next,", "next let's", "moving on",
  "let's talk about", "let's look at", "let's move", "so now",
  "alright,", "alright so", "okay so", "okay now", "first,", "second,",
  "third,", "finally,", "in conclusion", "to wrap up", "to summarize",
  "last thing", "one more", "before we", "by the way", "also,",
  "another thing", "the next", "step one", "step two", "step three",
]

export function detectChapters(result: TranscriptResult): Chapter[] {
  const chunks = result.chunks.filter(c => c.timestamp[0] != null)
  if (chunks.length < 3) return []

  const chapters: Chapter[]      = []
  const usedStarts = new Set<number>()

  function addChapter(start: number, label: string) {
    const sec = Math.floor(start)
    if (usedStarts.has(sec)) return
    if (chapters.length > 0 && sec - chapters[chapters.length - 1].start < 20) return
    usedStarts.add(sec)
    chapters.push({ start: sec, title: label })
  }

  addChapter(0, 'Introduction')

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const text  = (chunk.text ?? '').trim().toLowerCase()
    const start = chunk.timestamp[0]

    const isTransition = TRANSITION_PHRASES.some(p => text.startsWith(p) || text.includes(' ' + p))
    if (isTransition && start > 15) {
      const titleWords = chunks
        .slice(i, Math.min(i + 5, chunks.length))
        .map(c => (c.text ?? '').trim())
        .join(' ')
        .replace(/[^a-zA-Z0-9 ',.-]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 5)
        .join(' ')
      const capitalized = titleWords
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
      addChapter(start, capitalized || 'New Section')
    }

    if (i > 0) {
      const prev = chunks[i - 1]
      const gap  = start - (prev.timestamp[1] ?? prev.timestamp[0])
      if (gap >= 2.5 && start > 20) {
        const titleWords = chunks
          .slice(i, Math.min(i + 4, chunks.length))
          .map(c => (c.text ?? '').trim())
          .join(' ')
          .replace(/[^a-zA-Z0-9 ',.-]/g, '')
          .trim()
          .split(/\s+/)
          .slice(0, 5)
          .join(' ')
        const capitalized = titleWords
          .split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
        addChapter(start, capitalized || 'New Section')
      }
    }
  }

  chapters.sort((a, b) => a.start - b.start)
  return chapters
}

export function dedupeChapters(chapters: Chapter[]): Chapter[] {
  const out: Chapter[] = []
  for (const ch of chapters) {
    if (out.length === 0 || ch.start - out[out.length - 1].start >= 20) {
      out.push(ch)
    }
  }
  return out
}
