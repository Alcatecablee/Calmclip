import { isFFmpegBusy } from './ffmpeg'
import {
  writeModelSentinel,
  readModelSentinels,
  readCapabilityHint,
  getToolUsageScores,
} from './projectSession'
import type { WhisperModelId } from './whisper'

export interface WarmingStatus {
  modelId:    WhisperModelId
  modelLabel: string
  progress:   number
  done:       boolean
}

type StatusCallback = (s: WarmingStatus | null) => void

const MODEL_SIZE_BYTES: Record<WhisperModelId, number> = {
  'Xenova/whisper-tiny':   39  * 1024 * 1024,
  'Xenova/whisper-base':   74  * 1024 * 1024,
  'Xenova/whisper-small':  244 * 1024 * 1024,
  'Xenova/whisper-medium': 769 * 1024 * 1024,
}

const MODEL_LABEL: Record<WhisperModelId, string> = {
  'Xenova/whisper-tiny':   'Tiny',
  'Xenova/whisper-base':   'Base',
  'Xenova/whisper-small':  'Small',
  'Xenova/whisper-medium': 'Medium',
}

let _status:  WarmingStatus | null = null
let _running  = false
const _subs   = new Set<StatusCallback>()

function notify(s: WarmingStatus | null): void {
  _status = s
  for (const cb of _subs) cb(s)
}

export function getWarmingStatus(): WarmingStatus | null { return _status }
export function subscribeWarmingStatus(cb: StatusCallback): void   { _subs.add(cb) }
export function unsubscribeWarmingStatus(cb: StatusCallback): void { _subs.delete(cb) }

async function connectionOk(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conn = (navigator as any).connection
    if (conn && ['slow-2g', '2g', '3g'].includes(conn.effectiveType)) return false
  } catch { /* ignore */ }
  return true
}

async function storageOk(modelId: WhisperModelId): Promise<boolean> {
  try {
    const est       = await navigator.storage.estimate()
    const available = (est.quota ?? 0) - (est.usage ?? 0)
    return available > MODEL_SIZE_BYTES[modelId] * 2
  } catch { return true }
}

async function waitForExportEnd(): Promise<void> {
  if (!isFFmpegBusy()) return
  return new Promise(resolve => {
    const check = setInterval(() => {
      if (!isFFmpegBusy()) { clearInterval(check); resolve() }
    }, 5_000)
  })
}

function warmOne(modelId: WhisperModelId): Promise<void> {
  return new Promise(resolve => {
    notify({ modelId, modelLabel: MODEL_LABEL[modelId], progress: 0, done: false })

    const worker = new Worker(
      new URL('../workers/model-warmer.worker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = async (e: MessageEvent) => {
      const { type } = e.data
      if (type === 'warm-progress') {
        notify({ modelId, modelLabel: MODEL_LABEL[modelId], progress: e.data.progress ?? 0, done: false })
      } else if (type === 'warm-done') {
        notify({ modelId, modelLabel: MODEL_LABEL[modelId], progress: 100, done: true })
        await writeModelSentinel(modelId)
        worker.terminate()
        setTimeout(() => { if (_status?.modelId === modelId && _status.done) notify(null) }, 3500)
        resolve()
      } else if (type === 'warm-error') {
        worker.terminate()
        notify(null)
        resolve()
      }
    }

    worker.onerror = () => { worker.terminate(); notify(null); resolve() }

    worker.postMessage({ type: 'warm', modelId })
  })
}

export async function startWarmingQueue(currentModelId: WhisperModelId): Promise<void> {
  if (_running) return
  _running = true

  try {
    const hint    = await readCapabilityHint()
    const scores  = await getToolUsageScores()
    const cached  = new Set(await readModelSentinels())

    const targets: WhisperModelId[] = []

    // Phase 2 recommendation takes top priority
    if (
      hint?.recommendedNextModel &&
      hint.recommendedNextModel !== currentModelId &&
      !cached.has(hint.recommendedNextModel)
    ) {
      targets.push(hint.recommendedNextModel as WhisperModelId)
    }

    // Upgrade tiny users to base even without a hint
    if (
      currentModelId === 'Xenova/whisper-tiny' &&
      !cached.has('Xenova/whisper-base') &&
      !targets.includes('Xenova/whisper-base')
    ) {
      targets.push('Xenova/whisper-base')
    }

    // Warm small if the user transcribes frequently (score > 1.0 means used more than once recently)
    const transcribeScore = scores['transcribe'] ?? 0
    if (
      transcribeScore > 1.0 &&
      !cached.has('Xenova/whisper-small') &&
      !targets.includes('Xenova/whisper-small')
    ) {
      targets.push('Xenova/whisper-small')
    }

    for (const target of targets) {
      await waitForExportEnd()
      if (!(await connectionOk())) break
      if (!(await storageOk(target))) continue
      await warmOne(target)
    }
  } finally {
    _running = false
  }
}
