import { useRef, useState, useCallback } from 'react'
import type { RefObject } from 'react'
import type { SilenceSegment } from '../lib/silenceCutter'

interface UseManualCutsParams {
  trimStart: number
  trimEnd: number
  videoRef: RefObject<HTMLVideoElement | null>
}

export function useManualCuts({ trimStart, trimEnd, videoRef }: UseManualCutsParams) {
  const [manualCuts, setManualCuts] = useState<SilenceSegment[]>([])
  const manualCutsHistoryRef = useRef<SilenceSegment[][]>([])
  const manualCutsRedoRef    = useRef<SilenceSegment[][]>([])

  const undoLastManualCut = useCallback(() => {
    const history = manualCutsHistoryRef.current
    if (history.length === 0) return
    const prev = history[history.length - 1]
    manualCutsHistoryRef.current = history.slice(0, -1)
    manualCutsRedoRef.current = [...manualCutsRedoRef.current.slice(-19), manualCuts]
    setManualCuts(prev)
  }, [manualCuts])

  const redoLastManualCut = useCallback(() => {
    const redoStack = manualCutsRedoRef.current
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    manualCutsRedoRef.current = redoStack.slice(0, -1)
    manualCutsHistoryRef.current = [...manualCutsHistoryRef.current.slice(-19), manualCuts]
    setManualCuts(next)
  }, [manualCuts])

  const addManualCutAtPlayhead = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    manualCutsHistoryRef.current = [...manualCutsHistoryRef.current.slice(-19), manualCuts]
    manualCutsRedoRef.current = []
    const tPlay    = Math.max(0, v.currentTime - trimStart)
    const cutStart = Math.max(0, tPlay)
    const cutEnd   = Math.min(trimEnd - trimStart, cutStart + 1.5)
    setManualCuts(prev =>
      [...prev, { start: cutStart, end: cutEnd }].sort((a, b) => a.start - b.start)
    )
  }, [manualCuts, trimStart, trimEnd, videoRef])

  const clearManualCuts = useCallback(() => {
    manualCutsHistoryRef.current = []
    manualCutsRedoRef.current    = []
    setManualCuts([])
  }, [])

  const deleteManualCut = useCallback((idx: number) => {
    manualCutsHistoryRef.current = [...manualCutsHistoryRef.current.slice(-19), manualCuts]
    manualCutsRedoRef.current    = []
    setManualCuts(manualCuts.filter((_, i) => i !== idx))
  }, [manualCuts])

  return {
    manualCuts,
    setManualCuts,
    manualCutsHistoryRef,
    manualCutsRedoRef,
    undoLastManualCut,
    redoLastManualCut,
    addManualCutAtPlayhead,
    clearManualCuts,
    deleteManualCut,
  }
}
