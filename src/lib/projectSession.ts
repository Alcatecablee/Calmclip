import type { Ratio, CropMode, WatermarkOpts } from './ffmpeg'
import type { LoudnessTarget } from './loudness'
import type { BlurRegion } from '../components/FaceBlurPanel'
import type { SilenceSegment } from './silenceCutter'

const DB_NAME = 'calmclip_db'
const DB_VERSION = 1
const STORE_NAME = 'sessions'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

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
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
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
