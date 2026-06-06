import type { TranscriptResult } from './whisper'

const POWER_WORDS = new Set([
  'secret', 'reveal', 'discover', 'mistake', 'wrong', 'never', 'always',
  'best', 'worst', 'easiest', 'fastest', 'surprising', 'shocking', 'truth',
  'hidden', 'actually', 'finally', 'stop', 'start', 'instantly', 'simple',
  'hack', 'trick', 'proven', 'avoid', 'danger', 'warning', 'critical',
  'game-changer', 'life-changing', 'essential', 'must', 'need', 'powerful',
])

export interface HookResult {
  score:            number
  hookWPM:          number
  words:            number
  hasQuestion:      boolean
  hasDirectAddress: boolean
  startsImmediately: boolean
  powerCount:       number
  foundPower:       string[]
  firstLine:        string
  hookChunks:       number
}

export function scoreHook(transcript: TranscriptResult): HookResult {
  const chunks = transcript.chunks ?? []
  const hook   = chunks.filter(c => {
    const t = c.timestamp?.[0] ?? 0
    return t >= 0 && t <= 30
  })

  const text  = hook.map(c => c.text ?? '').join(' ').trim()
  const words = text.split(/\s+/).filter(Boolean)

  const lastEnd    = hook[hook.length - 1]?.timestamp?.[1] ?? hook[hook.length - 1]?.timestamp?.[0] ?? 0
  const firstStart = hook[0]?.timestamp?.[0] ?? 0
  const hookDur    = Math.max(0.01, Math.min(30, lastEnd - firstStart + 0.01))
  const hookWPM    = Math.round((words.length / hookDur) * 60)
  const firstChunk = hook[0]?.text?.trim() ?? ''
  const hasQuestion      = /\?/.test(text)
  const hasDirectAddress = /\byou\b|\byour\b/i.test(text.slice(0, 120))
  const startsImmediately = hook.length > 0 && (hook[0].timestamp?.[0] ?? 99) < 4

  const foundPowerClean = words
    .map(w => w.toLowerCase().replace(/[^a-z-]/g, ''))
    .filter(w => POWER_WORDS.has(w))
  const powerCount = new Set(foundPowerClean).size

  let score = 0
  if (startsImmediately) score += 20
  if (hasQuestion)       score += 20
  if (hasDirectAddress)  score += 15
  score += Math.min(25, powerCount * 8)
  if      (hookWPM >= 100 && hookWPM <= 180) score += 20
  else if (hookWPM >= 80  && hookWPM < 100)  score += 10
  else if (hookWPM > 180  && hookWPM <= 220) score += 12
  score = Math.min(100, score)

  return {
    score,
    hookWPM,
    words:             words.length,
    hasQuestion,
    hasDirectAddress,
    startsImmediately,
    powerCount,
    foundPower:        [...new Set(foundPowerClean)].slice(0, 6),
    firstLine:         firstChunk.slice(0, 90),
    hookChunks:        hook.length,
  }
}
