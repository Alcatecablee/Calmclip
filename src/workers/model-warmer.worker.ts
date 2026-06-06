import { pipeline, env } from '@xenova/transformers'

env.allowLocalModels = false
env.useBrowserCache  = true

type ProgressInfo = { status: string; name?: string; file?: string; progress?: number }

let _totalFiles  = 0
let _lastPct     = 0
const _filePct   = new Map<string, number>()

function aggregatePct(): number {
  if (_totalFiles === 0) return 0
  let sum = 0
  for (const p of _filePct.values()) sum += p
  const agg = Math.round(sum / _totalFiles)
  _lastPct = Math.max(_lastPct, Math.min(agg, 99))
  return _lastPct
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, modelId } = event.data as { type: string; modelId: string }
  if (type !== 'warm') return

  try {
    const progressCb = (info: ProgressInfo) => {
      const key = info.file ?? info.name ?? 'unknown'
      if (info.status === 'initiate') {
        if (!_filePct.has(key)) { _totalFiles++; _filePct.set(key, 0) }
      } else if (info.status === 'progress' && info.progress != null) {
        _filePct.set(key, info.progress)
        self.postMessage({ type: 'warm-progress', progress: aggregatePct() })
      } else if (info.status === 'done' || info.status === 'ready') {
        _filePct.set(key, 100)
        self.postMessage({ type: 'warm-progress', progress: aggregatePct() })
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instance: any = await (pipeline as (...args: any[]) => Promise<any>)(
      'automatic-speech-recognition',
      modelId,
      { progress_callback: progressCb },
    )

    await instance.dispose?.()

    self.postMessage({ type: 'warm-done' })
  } catch (err) {
    self.postMessage({ type: 'warm-error', message: err instanceof Error ? err.message : 'Warming failed.' })
  }
})
