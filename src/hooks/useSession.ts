import { useCallback, useEffect, useRef, useState } from 'react'
import { saveSession, listAllSessions, clearSessionByKey, type SessionData } from '../lib/projectSession'
import type { Ratio, CropMode } from '../lib/ffmpeg'
import type { LoudnessTarget } from '../lib/loudness'
import type { BlurRegion } from '../components/FaceBlurPanel'
import type { SilenceSegment } from '../lib/silenceCutter'
import type { WatermarkConfig } from '../components/WatermarkPanel'

export interface SessionSaveSnapshot {
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
  manualCuts:     SilenceSegment[]
  watermark:      WatermarkConfig | null
}

interface UseSessionParams {
  file:             File | null
  step:             string
  saveSnapshot:     SessionSaveSnapshot
  onApplySession:   (session: SessionData) => void
}

export function useSession({ file, step, saveSnapshot, onApplySession }: UseSessionParams) {
  const [sessionBanner,      setSessionBanner]      = useState(false)
  const [sessionSaveError,   setSessionSaveError]   = useState<string | null>(null)
  const [savedSessions,      setSavedSessions]      = useState<SessionData[]>([])
  const [showSessionsModal,  setShowSessionsModal]  = useState(false)
  const [pendingLoadSession, setPendingLoadSession] = useState<SessionData | null>(null)

  const snapshotRef      = useRef(saveSnapshot)
  const onApplyRef       = useRef(onApplySession)
  useEffect(() => { snapshotRef.current = saveSnapshot },      [saveSnapshot])
  useEffect(() => { onApplyRef.current  = onApplySession },    [onApplySession])

  const openSessionsModal = useCallback(() => {
    listAllSessions().then(sessions => {
      setSavedSessions(sessions)
      setShowSessionsModal(true)
    })
  }, [])

  const handleDeleteSession = useCallback((key: string) => {
    clearSessionByKey(key).then(() => {
      listAllSessions().then(sessions => {
        setSavedSessions(sessions)
      })
    })
  }, [])

  const handleLoadSession = useCallback((session: SessionData) => {
    if (file && `${file.name}__${file.size}` === session.fileKey) {
      onApplyRef.current(session)
      setShowSessionsModal(false)
      setPendingLoadSession(null)
    } else {
      setPendingLoadSession(session)
    }
  }, [file])

  useEffect(() => {
    if (!file || step !== 'edit') return
    const snap = snapshotRef.current
    const t = setTimeout(() => {
      saveSession(file, {
        trimStart:      snap.trimStart,
        trimEnd:        snap.trimEnd,
        ratio:          snap.ratio,
        cropMode:       snap.cropMode,
        loudness:       snap.loudness,
        stripMeta:      snap.stripMeta,
        blurRegions:    snap.blurRegions,
        silenceSegs:    snap.silenceSegs,
        removeSilence:  snap.removeSilence,
        denoiseAudio:   snap.denoiseAudio,
        manualCuts:     snap.manualCuts,
        watermark: snap.watermark
          ? {
              file:     snap.watermark.file,
              position: snap.watermark.position,
              opacity:  snap.watermark.opacity,
              scale:    snap.watermark.scale,
              margin:   snap.watermark.margin ?? 10,
            }
          : null,
      }).then(result => {
        if (!result.ok) {
          setSessionSaveError(result.error ?? 'Session could not be saved.')
        } else {
          setSessionSaveError(null)
        }
      })
    }, 800)
    return () => clearTimeout(t)
  }, [
    file, step,
    saveSnapshot.trimStart, saveSnapshot.trimEnd,
    saveSnapshot.ratio, saveSnapshot.cropMode, saveSnapshot.loudness,
    saveSnapshot.stripMeta, saveSnapshot.blurRegions,
    saveSnapshot.silenceSegs, saveSnapshot.removeSilence,
    saveSnapshot.denoiseAudio, saveSnapshot.manualCuts, saveSnapshot.watermark,
  ])

  return {
    sessionBanner,
    setSessionBanner,
    sessionSaveError,
    setSessionSaveError,
    savedSessions,
    showSessionsModal,
    setShowSessionsModal,
    pendingLoadSession,
    setPendingLoadSession,
    openSessionsModal,
    handleDeleteSession,
    handleLoadSession,
  }
}
