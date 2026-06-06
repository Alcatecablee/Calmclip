import type { Ratio, CropMode, WatermarkOpts } from './ffmpeg'
import type { LoudnessTarget } from './loudness'
import type { BlurRegion } from '../components/FaceBlurPanel'
import type { SilenceSegment } from './silenceCutter'
import type { Word, CaptionStyle } from './captionEngine'

const DB_NAME    = 'calmclip_db'
const DB_VERSION = 2
const STORE_NAME = 'sessions'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const STORE_HINTS     = 'calmclip_capability_hints'
const STORE_SENTINELS = 'calmclip_model_sentinels'
const STORE_USAGE     = 'calmclip_tool_usage'

export type ToolId = 'transcribe' | 'faceBlur' | 'silenceCut' | 'loudness' | 'captions' | 'batchExport'

export interface CapabilityHint {
  detectedLanguage:    string
  recommendedNextModel: string | null
  recordedAt:          number
}

export interface ToolUsageRecord {
  toolId:    ToolId
  useCount:  number
  lastUsed:  number
}

export interface SessionData {
  fileKey:        string
  savedAt:        number
  trimStart:      number
  trimEnd:        number
  ratio:          Ratio
  cropMode:       CropMode
  loudness:       LoudnessTarget
  stripMeta:      boolean
  blurRegions:    BlurRegion[]
  silenceSegs:    SilenceSegment[]
  removeSilence:  boolean
  denoiseAudio:   boolean
  manualCuts?:    SilenceSegment[]
  watermark?:     WatermarkOpts | null
  words?:         Word[]
  captionStyle?:  CaptionStyle
}

function makeFileKey(file: File): string {
  return `${file.name}__${file.size}__${file.lastModified}`
}

export interface SaveResult {
  ok:    boolean
  error: string | null
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME))     db.createObjectStore(STORE_NAME)
      if (!db.objectStoreNames.contains(STORE_HINTS))    db.createObjectStore(STORE_HINTS)
      if (!db.objectStoreNames.contains(STORE_SENTINELS)) db.createObjectStore(STORE_SENTINELS)
      if (!db.objectStoreNames.contains(STORE_USAGE))    db.createObjectStore(STORE_USAGE)
    }
  })
}

// --- Phase 2: Capability hints ---

function recommendNextModel(detectedLanguage: string, currentModelId: string): string | null {
  if (detectedLanguage === 'english') {
    return currentModelId === 'Xenova/whisper-tiny' ? 'Xenova/whisper-base' : null
  }
  return 'Xenova/whisper-small'
}

export async function writeCapabilityHint(detectedLanguage: string, currentModelId: string): Promise<void> {
  try {
    const db   = await getDB()
    const hint: CapabilityHint = {
      detectedLanguage,
      recommendedNextModel: recommendNextModel(detectedLanguage, currentModelId),
      recordedAt: Date.now(),
    }
    return new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_HINTS, 'readwrite')
      tx.objectStore(STORE_HINTS).put(hint, 'current')
      tx.oncomplete = () => resolve()
      tx.onerror    = () => resolve()
    })
  } catch { /* ignore */ }
}

export async function readCapabilityHint(): Promise<CapabilityHint | null> {
  try {
    const db = await getDB()
    return new Promise<CapabilityHint | null>((resolve) => {
      const req = db.transaction(STORE_HINTS, 'readonly').objectStore(STORE_HINTS).get('current')
      req.onsuccess = () => resolve((req.result as CapabilityHint) ?? null)
      req.onerror   = () => resolve(null)
    })
  } catch { return null }
}

// --- Phase 3: Model sentinels ---

export async function writeModelSentinel(modelId: string): Promise<void> {
  try {
    const db = await getDB()
    return new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_SENTINELS, 'readwrite')
      tx.objectStore(STORE_SENTINELS).put({ modelId, cachedAt: Date.now() }, modelId)
      tx.oncomplete = () => resolve()
      tx.onerror    = () => resolve()
    })
  } catch { /* ignore */ }
}

export async function readModelSentinels(): Promise<string[]> {
  try {
    const db = await getDB()
    return new Promise<string[]>((resolve) => {
      const req = db.transaction(STORE_SENTINELS, 'readonly').objectStore(STORE_SENTINELS).getAllKeys()
      req.onsuccess = () => resolve((req.result as string[]) ?? [])
      req.onerror   = () => resolve([])
    })
  } catch { return [] }
}

export async function clearModelSentinel(modelId: string): Promise<void> {
  try {
    const db = await getDB()
    return new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_SENTINELS, 'readwrite')
      tx.objectStore(STORE_SENTINELS).delete(modelId)
      tx.oncomplete = () => resolve()
      tx.onerror    = () => resolve()
    })
  } catch { /* ignore */ }
}

// --- Phase 6: Tool usage tracking ---

export async function recordToolUsage(toolId: ToolId): Promise<void> {
  try {
    const db = await getDB()
    const existing: ToolUsageRecord | null = await new Promise((resolve) => {
      const req = db.transaction(STORE_USAGE, 'readonly').objectStore(STORE_USAGE).get(toolId)
      req.onsuccess = () => resolve((req.result as ToolUsageRecord) ?? null)
      req.onerror   = () => resolve(null)
    })
    const record: ToolUsageRecord = {
      toolId,
      useCount: (existing?.useCount ?? 0) + 1,
      lastUsed: Date.now(),
    }
    return new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_USAGE, 'readwrite')
      tx.objectStore(STORE_USAGE).put(record, toolId)
      tx.oncomplete = () => resolve()
      tx.onerror    = () => resolve()
    })
  } catch { /* ignore */ }
}

export async function getToolUsageScores(): Promise<Partial<Record<ToolId, number>>> {
  try {
    const db = await getDB()
    const records: ToolUsageRecord[] = await new Promise((resolve) => {
      const req = db.transaction(STORE_USAGE, 'readonly').objectStore(STORE_USAGE).getAll()
      req.onsuccess = () => resolve((req.result as ToolUsageRecord[]) ?? [])
      req.onerror   = () => resolve([])
    })
    const now = Date.now()
    const scores: Partial<Record<ToolId, number>> = {}
    for (const r of records) {
      const daysSince = (now - r.lastUsed) / (1000 * 60 * 60 * 24)
      scores[r.toolId] = r.useCount * Math.exp(-daysSince / 30)
    }
    return scores
  } catch { return {} }
}

export async function saveSession(file: File, data: Omit<SessionData, 'fileKey' | 'savedAt'>): Promise<SaveResult> {
  try {
    const db = await getDB()
    const key = makeFileKey(file)
    const session: SessionData = {
      ...data,
      fileKey: key,
      savedAt: Date.now(),
    }
    return new Promise<SaveResult>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(session, key)
      request.onsuccess = () => resolve({ ok: true, error: null })
      request.onerror = () => resolve({ ok: false, error: request.error?.message ?? 'Write error' })
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function loadSession(file: File): Promise<SessionData | null> {
  try {
    const db = await getDB()
    const key = makeFileKey(file)
    return new Promise<SessionData | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(key)
      request.onsuccess = () => {
        const session = request.result as SessionData | undefined
        if (!session) {
          resolve(null)
          return
        }
        if (Date.now() - session.savedAt > MAX_AGE_MS) {
          const deleteTx = db.transaction(STORE_NAME, 'readwrite')
          deleteTx.objectStore(STORE_NAME).delete(key)
          resolve(null)
        } else {
          resolve(session)
        }
      }
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function clearSession(file: File): Promise<void> {
  try {
    const db = await getDB()
    const key = makeFileKey(file)
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch {
    // Ignore
  }
}

export async function clearSessionByKey(key: string): Promise<void> {
  try {
    const db = await getDB()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch {
    // Ignore
  }
}

export async function listAllSessions(): Promise<SessionData[]> {
  try {
    const db = await getDB()
    return new Promise<SessionData[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => {
        const results = (request.result as SessionData[]) || []
        const now = Date.now()
        const valid = results.filter(session => {
          if (now - session.savedAt > MAX_AGE_MS) {
            const deleteTx = db.transaction(STORE_NAME, 'readwrite')
            deleteTx.objectStore(STORE_NAME).delete(session.fileKey)
            return false
          }
          return true
        })
        resolve(valid)
      }
      request.onerror = () => reject(request.error)
    })
  } catch {
    return []
  }
}
