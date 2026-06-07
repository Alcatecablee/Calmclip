import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  RotateCcw, Scissors, Camera, Layers,
  Volume2, VolumeX, EyeOff, Lock, Info,
  Sparkles, Check, Keyboard, FolderOpen,
  Clipboard, MonitorPlay, Captions, Download,
} from 'lucide-react'
import { AlertTriangle, AlertCircle, X } from 'lucide-react'
import DropZone, { type DropZoneHandle } from './components/DropZone'
import ProUnlockModal from './components/ProUnlockModal'
import { isPro as checkIsPro, getProStatus, initPro } from './lib/pro'
import TrimSlider from './components/TrimSlider'
import LoudnessPanel from './components/LoudnessPanel'
import MetadataReport from './components/MetadataReport'
import ScreenRecordButton from './components/ScreenRecordButton'
import SilenceCutterPanel, { SILENCE_SCAN_DEFAULT, type SilenceScanState } from './components/SilenceCutterPanel'
import FaceBlurPanel, { BLUR_FORM_DEFAULT, type BlurFormState, type BlurRegion } from './components/FaceBlurPanel'
import WatermarkPanel, { type WatermarkConfig } from './components/WatermarkPanel'
import VideoPreview from './components/VideoPreview'
import ThumbnailExtractor from './components/ThumbnailExtractor'
import Section, { HeaderToggle } from './components/Section'
import Tooltip from './components/Tooltip'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal'
import InstallPrompt from './components/InstallPrompt'
import UpdateBanner from './components/UpdateBanner'
import PostInstallTip from './components/PostInstallTip'
import { usePWA } from './hooks/usePWA'
import { useTrim } from './hooks/useTrim'
import { useManualCuts } from './hooks/useManualCuts'
import { useSession, type SessionSaveSnapshot } from './hooks/useSession'
import { loadFfmpeg, isFFLoaded, type Ratio, type CropMode } from './lib/ffmpeg'
import { parseVideoMeta, type VideoMeta } from './lib/metadata'
import type { LoudnessTarget } from './lib/loudness'
import type { SilenceSegment } from './lib/silenceCutter'
import { loadSession, recordToolUsage, type SessionData } from './lib/projectSession'
import { formatBytes } from './lib/exportHandlers'
import { togglePip, copyFrameToClipboard } from './lib/videoTools'
import SessionsModal from './components/SessionsModal'
import DiagnosticsModal from './components/DiagnosticsModal'
import LandingHowItWorks from './components/LandingHowItWorks'
import LandingFeatures from './components/LandingFeatures'
import LandingAudience from './components/LandingAudience'
import LandingSisterTools from './components/LandingSisterTools'
import LandingPricing from './components/LandingPricing'
import LandingFAQ from './components/LandingFAQ'
import TranscribeButton from './components/TranscribeButton'
import CaptionEditor from './components/CaptionEditor'
import CaptionStylePanel from './components/CaptionStylePanel'
import ExportPanel from './components/ExportPanel'
import { groupWords, CAPTION_PRESETS } from './lib/captionEngine'
import type { Word, CaptionStyle } from './lib/captionEngine'
import HookScorer from './components/HookScorer'
import FillerWordPanel from './components/FillerWordPanel'
import PaceAnalyzer from './components/PaceAnalyzer'
import BRollGapDetector from './components/BRollGapDetector'
import BatchExportPanel from './components/BatchExportPanel'
import ExportPresets, { type ExportPreset } from './components/ExportPresets'
import AIAssistPanel from './components/AIAssistPanel'
import ChapterGenerator from './components/ChapterGenerator'
import { PreExportReport, PostExportReport } from './components/ExportReport'
import FileSizeReadout from './components/FileSizeReadout'
import type { TranscriptResult, TranscriptChunk } from './lib/whisper'
import { batchExport, type BatchProgress } from './lib/batchExport'
import FeatureLandingPage from './components/FeatureLandingPage'
import { FEATURE_PAGES } from './lib/featurePages'


function fmtDur(s: number): string {
  const m  = Math.floor(s / 60)
  const ss = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}:${ss}`
}



export default function App() {
  const videoRef       = useRef<HTMLVideoElement>(null)
  const videoUrlRef    = useRef<string | null>(null)
  const pendingTrimRef = useRef<{ start: number; end: number } | null>(null)
  const dropZoneRef    = useRef<DropZoneHandle>(null)
  const dragCounter    = useRef(0)

  // --- Focused hooks ---

  const { trimStart, setTrimStart, trimEnd, setTrimEnd } = useTrim()

  const currentFeaturePage = useMemo(() => {
    const path = window.location.pathname.replace(/\/$/, '')
    return FEATURE_PAGES.find(p => `/${p.slug}` === path) ?? null
  }, [])

  const {
    manualCuts,
    setManualCuts,
    manualCutsHistoryRef,
    manualCutsRedoRef,
    undoLastManualCut,
    redoLastManualCut,
    addManualCutAtPlayhead,
    clearManualCuts,
    deleteManualCut,
  } = useManualCuts({ trimStart, trimEnd, videoRef })

  // --- Remaining local state ---

  // True once the FFmpeg WASM core has loaded. Initialized from the module
  // singleton so second file loads skip the notice immediately.
  // Also treated as true if the user has seen the notice before (localStorage),
  // to avoid showing it again on a fresh page load where the WASM is cached.
  const [ffLoaded, setFfLoaded] = useState<boolean>(
    () => isFFLoaded() || localStorage.getItem('calmclip_wasm_seen') === '1'
  )

  const [file,       setFile]       = useState<File | null>(null)
  const [videoUrl,   setVideoUrl]   = useState<string | null>(null)
  const [duration,   setDuration]   = useState(0)
  const [step, setStep] = useState<'drop' | 'edit'>('drop')
  const [ratio,      setRatio]      = useState<Ratio>('16:9')
  const [cropMode,   setCropMode]   = useState<CropMode>('fit')
  const [loudness,   setLoudness]   = useState<LoudnessTarget>('off')
  const [stripMeta,      setStripMeta]      = useState(true)
  const [meta,           setMeta]           = useState<VideoMeta | null>(null)
  const [metaScanFailed, setMetaScanFailed] = useState(false)
  const [silenceSegs,      setSilenceSegs]      = useState<SilenceSegment[]>([])
  const [silenceSourceKey, setSilenceSourceKey] = useState<string | null>(null)
  const [removeSilence,    setRemoveSilence]    = useState(false)
  const [silenceSegsStale, setSilenceSegsStale] = useState(false)
  const [silenceScanState, setSilenceScanState] = useState<SilenceScanState>(SILENCE_SCAN_DEFAULT)
  const [blurRegions,   setBlurRegions]   = useState<BlurRegion[]>([])
  const [blurFormState, setBlurFormState] = useState<BlurFormState>(BLUR_FORM_DEFAULT)
  const [hasAudio, setHasAudio] = useState(true)
  const [watermark, setWatermark] = useState<WatermarkConfig | null>(null)
  const [denoiseAudio,  setDenoiseAudio]  = useState(false)
  const [isDrawingBlur, setIsDrawingBlur] = useState(false)
  const [isPip,          setIsPip]          = useState(false)
  const [frameCopied,    setFrameCopied]    = useState(false)
  const [videoToolError, setVideoToolError] = useState<string | null>(null)
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false)
  const [proActive,    setProActive]    = useState(() => checkIsPro())
  const [showProModal, setShowProModal] = useState(false)
  const [fps,          setFps]          = useState<number | null>(null)
  const [proModalView, setProModalView] = useState<'manage' | 'unlock' | 'restore'>('unlock')
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  const [openSection,    setOpenSection]    = useState<string>('trim')
  const [windowDragging, setWindowDragging] = useState(false)

  const [words,        setWords]        = useState<Word[]>([])
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(CAPTION_PRESETS.boldPop)
  const captionGroups = useMemo(() => groupWords(words, captionStyle.wordsPerGroup), [words, captionStyle.wordsPerGroup])

  const [transcriptResult, setTranscriptResult] = useState<TranscriptResult | null>(null)
  const [transcriptLanguage, setTranscriptLanguage] = useState<string | undefined>(undefined)
  const [removedFillers,   setRemovedFillers]   = useState<TranscriptChunk[]>([])
  const [batchRunning,     setBatchRunning]     = useState(false)
  const [batchProgress,    setBatchProgress]    = useState<BatchProgress[]>([])
  const [videoWidth,       setVideoWidth]       = useState(0)
  const [videoHeight,      setVideoHeight]      = useState(0)
  const [exportedSize,     setExportedSize]     = useState(0)

  const fillerCuts = useMemo<SilenceSegment[]>(() => (
    removedFillers
      .filter(c => c.timestamp[0] != null && c.timestamp[1] != null)
      .map(c => ({ start: c.timestamp[0]!, end: c.timestamp[1]! }))
  ), [removedFillers])

  const hasPip       = 'pictureInPictureEnabled' in document && (document as Document & { pictureInPictureEnabled: boolean }).pictureInPictureEnabled
  // Clipboard.write() is absent from older TS DOM lib versions; casting to unknown lets us
  // feature-detect it at runtime without a type error on environments where it is defined.
  const hasClipboard = 'clipboard' in navigator && typeof (navigator.clipboard as unknown as Record<string, unknown>).write === 'function'

  const { installState, updateState, triggerInstall, dismissInstall, applyUpdate, launchFile, clearLaunchFile, extensionError, clearExtensionError, extensionLoading, startRecording, clearStartRecording } = usePWA()

  // --- useSession ---
  // applySessionData calls setSessionBanner (from useSession), so we use a ref
  // to break the circular dependency: useSession stores onApplySession in a ref
  // internally, so it is always called with the latest version of applySessionData.

  const applySessionDataRef = useRef<(session: SessionData) => void>(() => {})
  const onApplySession      = useCallback((s: SessionData) => applySessionDataRef.current(s), [])

  const saveSnapshot: SessionSaveSnapshot = {
    trimStart, trimEnd, ratio, cropMode, loudness, stripMeta,
    blurRegions, silenceSegs, removeSilence,
    denoiseAudio, manualCuts, watermark,
    words, captionStyle,
  }

  const {
    sessionBanner,
    setSessionBanner,
    sessionSaveError,
    setSessionSaveError,
    isDirty,
    savedSessions,
    showSessionsModal,
    setShowSessionsModal,
    pendingLoadSession,
    setPendingLoadSession,
    openSessionsModal,
    handleDeleteSession,
    handleLoadSession,
  } = useSession({ file, step, saveSnapshot, onApplySession })

  // Re-verify the stored Pro license against Gumroad on mount.
  useEffect(() => {
    initPro().then(active => setProActive(active))
  }, [])

  const openProModal = useCallback(() => {
    setProModalView(checkIsPro() ? 'manage' : 'unlock')
    setShowProModal(true)
  }, [])

  // applySessionData restores all fields from a saved session.
  // Defined after useSession so setSessionBanner is available.
  const applySessionData = useCallback((session: SessionData) => {
    pendingTrimRef.current = { start: session.trimStart, end: session.trimEnd }
    setRatio(session.ratio)
    setCropMode(session.cropMode)
    setLoudness(session.loudness)
    setStripMeta(session.stripMeta)
    setBlurRegions(session.blurRegions)
    setSilenceSegs(session.silenceSegs)
    setSilenceSegsStale(false)
    setSilenceSourceKey(session.fileKey)
    setRemoveSilence(session.removeSilence)
    setSilenceScanState(prev => ({
      ...prev,
      phase:    session.silenceSegs.length > 0 ? 'done' : 'idle',
      segments: session.silenceSegs,
      error:    null,
    }))
    setDenoiseAudio(session.denoiseAudio ?? false)
    setManualCuts(session.manualCuts ?? [])
    if (session.watermark) setWatermark(session.watermark)
    if (session.words?.length) setWords(session.words)
    if (session.captionStyle) setCaptionStyle(session.captionStyle)
    setSessionBanner(true)
    setTimeout(() => setSessionBanner(false), 4000)
  }, [setManualCuts, setSessionBanner])

  // Keep the ref fresh so useSession always calls the latest version.
  useEffect(() => { applySessionDataRef.current = applySessionData }, [applySessionData])

  const handleFile = useCallback((f: File) => {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
    const url = URL.createObjectURL(f)
    videoUrlRef.current = url
    setFile(f)
    setExportedSize(0)
    setVideoWidth(0)
    setVideoHeight(0)
    loadFfmpeg().then(() => {
      localStorage.setItem('calmclip_wasm_seen', '1')
      setFfLoaded(true)
    }).catch(() => {})
    setVideoUrl(url)
    setStep('edit')
    document.title = 'CalmClip | Editing ' + f.name
    setMeta(null)
    setHasAudio(true)

    loadSession(f).then(session => {
      if (session) {
        applySessionData(session)
        setShowSessionsModal(false)
        setPendingLoadSession(null)
      } else {
        pendingTrimRef.current = null
        setTrimStart(0)
        setTrimEnd(0)
        setRatio('16:9')
        setCropMode('fit')
        setLoudness('off')
        setStripMeta(true)
        setMetaScanFailed(false)
        setSilenceSegs([])
        setSilenceSegsStale(false)
        setSilenceSourceKey(null)
        setRemoveSilence(false)
        setSilenceScanState(SILENCE_SCAN_DEFAULT)
        setBlurRegions([])
        setBlurFormState(BLUR_FORM_DEFAULT)
        setDenoiseAudio(false)
        clearManualCuts()
      }
    })
    setMeta(null)
    setMetaScanFailed(false)
    parseVideoMeta(f)
      .then(m => {
        setMeta(m)
        const v = videoRef.current
        const tracks = v
          ? (v as HTMLVideoElement & { audioTracks?: { length: number } }).audioTracks
          : undefined
        if (tracks === undefined) {
          setHasAudio(m.hasAudio)
        } else {
          setHasAudio(tracks.length > 0)
        }
      })
      .catch(() => setMetaScanFailed(true))
  }, [applySessionData, clearManualCuts, setStep, setShowSessionsModal, setPendingLoadSession, setTrimStart, setTrimEnd])

  // File Handling API: a file was opened from the OS into the installed PWA.
  // If the user is already editing, confirm before discarding their work.
  useEffect(() => {
    if (!launchFile) return
    if (file && step === 'edit') {
      const ok = window.confirm(
        'You are currently editing a video. Open a new file and discard your current work?',
      )
      if (!ok) {
        clearLaunchFile()
        return
      }
    }
    handleFile(launchFile)
    clearLaunchFile()
  // handleFile is stable (useCallback with no deps that change identity)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchFile])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !videoUrl) return
    const onMeta = () => {
      setDuration(v.duration)
      setVideoWidth(v.videoWidth)
      setVideoHeight(v.videoHeight)
      if (pendingTrimRef.current !== null) {
        setTrimStart(pendingTrimRef.current.start)
        setTrimEnd(pendingTrimRef.current.end)
        pendingTrimRef.current = null
      } else {
        setTrimEnd(v.duration)
      }
      const tracks = (v as HTMLVideoElement & { audioTracks?: { length: number } }).audioTracks
      if (tracks !== undefined) {
        setHasAudio(tracks.length > 0)
      }
    }
    const onDurationChange = () => {
      if (!isFinite(v.duration) || v.duration <= 0) return
      setDuration(v.duration)
      setTrimEnd(prev => (prev <= 0 ? v.duration : prev))
    }
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('durationchange', onDurationChange)
    if (v.readyState >= 1 && v.duration > 0) {
      onMeta()
    }
    return () => {
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('durationchange', onDurationChange)
    }
  }, [videoUrl, setTrimStart, setTrimEnd])

  useEffect(() => {
    return () => {
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
    }
  }, [])

  // Detect video fps non-intrusively: sample frames on the user's first play.
  useEffect(() => {
    const v = videoRef.current
    if (!v || step !== 'edit' || !videoUrl) return
    setFps(null)
    if (!('requestVideoFrameCallback' in v)) return

    type FrameCB = (now: DOMHighResTimeStamp, meta: { presentedFrames: number }) => void
    let handle: number | null = null
    let samples: Array<{ frames: number; t: DOMHighResTimeStamp }> = []

    const detect: FrameCB = (now, meta) => {
      samples.push({ frames: meta.presentedFrames, t: now })
      if (samples.length >= 4) {
        const dt = samples[samples.length - 1].t - samples[0].t
        const df = samples[samples.length - 1].frames - samples[0].frames
        if (dt > 0 && df > 0) { setFps(Math.round(df / dt * 1000)); return }
      }
      if (samples.length < 8) {
        handle = (v as any).requestVideoFrameCallback(detect)
      }
    }

    const onFirstPlay = () => {
      handle = (v as any).requestVideoFrameCallback(detect)
      v.removeEventListener('play', onFirstPlay)
    }
    v.addEventListener('play', onFirstPlay)

    return () => {
      v.removeEventListener('play', onFirstPlay)
      if (handle !== null) (v as any).cancelVideoFrameCallback(handle)
    }
  }, [videoUrl, step])

  // Trim start moved: relative silence timestamps are now wrong. Clear and notify.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (silenceSegs.length > 0) {
      setSilenceSegs([])
      setSilenceSourceKey(null)
      setRemoveSilence(false)
      setSilenceSegsStale(true)
      setSilenceScanState(prev => ({ ...prev, phase: 'idle', segments: [], error: null }))
    }
  }, [trimStart])

  // Trim end moved: existing segments are still timestamp-correct but may be
  // incomplete for any newly exposed range. Mark stale so the user knows to re-scan.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (silenceSegs.length > 0) {
      setSilenceSegsStale(true)
    }
  }, [trimEnd])

  const handleSilenceSegments = useCallback((segs: SilenceSegment[]) => {
    setSilenceSegs(segs)
    setSilenceSegsStale(false)
    setSilenceSourceKey(file ? `${file.name}__${file.size}` : null)
  }, [file])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag     = (e.target as HTMLElement).tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (inInput) return
        e.preventDefault()
        undoLastManualCut()
        return
      }

      if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Z') ||
        (e.ctrlKey && !e.shiftKey && !e.metaKey && e.key === 'y')
      ) {
        if (inInput) return
        e.preventDefault()
        redoLastManualCut()
        return
      }

      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !inInput) {
        e.preventDefault()
        setShowShortcutsModal(prev => !prev)
        return
      }

      if (step !== 'edit' || inInput) return
      const v = videoRef.current
      if (!v) return

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        v.currentTime = Math.max(trimStart, v.currentTime - 5)
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        v.currentTime = Math.min(trimEnd, v.currentTime + 5)
      } else if (e.key === '[') {
        e.preventDefault()
        const t = Math.max(0, Math.min(v.currentTime, trimEnd - 0.1))
        setTrimStart(t)
      } else if (e.key === ']') {
        e.preventDefault()
        const t = Math.max(trimStart + 0.1, Math.min(v.currentTime, duration))
        setTrimEnd(t)
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        addManualCutAtPlayhead()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [undoLastManualCut, redoLastManualCut, step, trimStart, trimEnd, duration, addManualCutAtPlayhead, setTrimStart, setTrimEnd])

  useEffect(() => {
    function onDragEnter(e: DragEvent) {
      if (!e.dataTransfer?.types.includes('Files')) return
      dragCounter.current += 1
      if (dragCounter.current === 1) setWindowDragging(true)
    }
    function onDragLeave() {
      dragCounter.current -= 1
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setWindowDragging(false)
      }
    }
    function onDrop() {
      dragCounter.current = 0
      setWindowDragging(false)
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [step])

  async function handlePip() {
    const video = videoRef.current
    if (!video) return
    try {
      const state = await togglePip(video)
      setIsPip(state === 'entered')
      if (state === 'entered') {
        video.addEventListener('leavepictureinpicture', () => setIsPip(false), { once: true })
      }
    } catch {
      setVideoToolError('Could not float video. Click the video first, then try again.')
      setTimeout(() => setVideoToolError(null), 2500)
    }
  }

  function handleCopyFrame() {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    copyFrameToClipboard(video).then(() => {
      setFrameCopied(true)
      setTimeout(() => setFrameCopied(false), 1500)
    }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Could not capture frame.'
      setVideoToolError(msg)
      setTimeout(() => setVideoToolError(null), 2500)
    })
  }

  function handleReset() {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
    videoUrlRef.current = null
    setStep('drop')
    document.title = 'CalmClip'
    setFile(null)
    setVideoUrl(null)
    setDuration(0)
    setTrimStart(0)
    setTrimEnd(0)
    setRatio('16:9')
    setCropMode('fit')
    setLoudness('off')
    setStripMeta(true)
    setMeta(null)
    setMetaScanFailed(false)
    setSilenceSegs([])
    setSilenceSegsStale(false)
    setSilenceSourceKey(null)
    setRemoveSilence(false)
    setSilenceScanState(SILENCE_SCAN_DEFAULT)
    setBlurRegions([])
    setBlurFormState(BLUR_FORM_DEFAULT)
    setIsDrawingBlur(false)
    clearManualCuts()
    setVideoToolError(null)
    setWatermark(null)
    setSessionBanner(false)
    setSessionSaveError(null)
    setDenoiseAudio(false)
    setIsPip(false)
    setFrameCopied(false)
    setWords([])
    setCaptionStyle(CAPTION_PRESETS.boldPop)
  }


  useEffect(() => {
    if (step !== 'drop') return
    const els = document.querySelectorAll<HTMLElement>('.section-reveal')
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible')
          obs.unobserve(e.target)
        }
      }),
      { threshold: 0.1, rootMargin: '0px 0px -32px 0px' },
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [step])

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-page)' }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault()
        const f = e.dataTransfer.files[0]
        if (f && (f.type.startsWith('video/') || f.type.startsWith('audio/'))) handleFile(f)
      }}
    >
      <header className={`navbar-header${step !== 'drop' ? ' navbar-header--slim' : ''}`}>
        <a href="/" className="navbar-logo-container" style={{ textDecoration: 'none' }}>
          <img src="/logo.png" alt="CalmClip" style={{ height: step !== 'drop' ? 24 : 30, width: step !== 'drop' ? 24 : 30, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
          {step === 'drop' && (
            <img src="/wordmark.png" alt="" aria-hidden="true" style={{ height: 24, width: 'auto', objectFit: 'contain', display: 'block', flexShrink: 0, marginTop: 5 }} />
          )}
        </a>

        {step === 'drop' && (
          <nav className="navbar-center">
            <a
              href="#how-it-works"
              onClick={e => { e.preventDefault(); document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }) }}
              className="navbar-nav-link"
            >
              How it works
            </a>
            <a
              href="#features"
              onClick={e => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }) }}
              className="navbar-nav-link"
            >
              Features
            </a>
            <a
              href="#pricing"
              onClick={e => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }) }}
              className="navbar-nav-link"
            >
              Pricing
            </a>
          </nav>
        )}

        {step !== 'drop' && file && (() => {
          const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
          const baseName    = file.name.replace(/\.[^.]+$/, '')
          const displayName = baseName.length > 22 ? baseName.slice(0, 22) + '\u2026' : baseName
          const isTrimmed   = trimStart > 0.5 || (duration > 0 && trimEnd < duration - 0.5)
          const trimmedDur  = Math.max(0, trimEnd - trimStart)
          const bps         = proActive ? 5_000_000 : 2_500_000
          const estMB       = trimmedDur > 0 ? Math.round(trimmedDur * bps / 8 / 1_000_000) : null
          const TOOL_LABELS: Record<string, string> = {
            'trim': 'Trim', 'silence-cutter': 'Silence', 'region-blur': 'Blur',
            'loudness': 'Audio', 'captions': 'Captions', 'privacy': 'Privacy',
            'watermark': 'Brand', 'thumbnail': 'Frame', 'export': 'Export',
          }
          const dotColor = sessionSaveError ? '#ef4444' : isDirty ? '#f59e0b' : '#10b981'
          const dotTitle = sessionSaveError ? 'Save failed' : isDirty ? 'Saving\u2026' : 'All changes saved'
          return (
            <div className="navbar-file-badge">
              <span
                className="navbar-save-dot"
                style={{ background: dotColor }}
                title={dotTitle}
                aria-label={dotTitle}
              />
              <span className="navbar-file-name">{displayName}</span>
              <span className="navbar-badge-sep" aria-hidden="true">·</span>
              {isTrimmed ? (
                <span className="navbar-file-dur navbar-file-trim-active">
                  {fmtTime(trimStart)}<span className="navbar-file-trim-arrow"> - </span>{fmtTime(trimEnd)}
                </span>
              ) : duration > 0 ? (
                <span className="navbar-file-dur">{fmtTime(duration)}</span>
              ) : null}
              <span className="navbar-badge-rule" aria-hidden="true" />
              <span className="navbar-badge-tool">{TOOL_LABELS[openSection] ?? ''}</span>
              <span className="navbar-badge-rule navbar-badge-hide-md" aria-hidden="true" />
              <span className="navbar-badge-meta navbar-badge-hide-md">
                {fps !== null ? `${fps}fps` : <span style={{ opacity: 0.35 }}>—fps</span>}
              </span>
              <span className="navbar-badge-rule navbar-badge-hide-md" aria-hidden="true" />
              <span className="navbar-badge-meta navbar-badge-hide-md">
                {estMB !== null ? `~${estMB}\u00a0MB` : '\u2014'}
              </span>
            </div>
          )
        })()}

        <div className="navbar-btn-group">
          <Tooltip text="Keyboard shortcuts (?)" position="bottom">
            <button
              onClick={() => setShowShortcutsModal(true)}
              className="navbar-icon-btn"
            >
              <Keyboard size={16} />
            </button>
          </Tooltip>
          <Tooltip text="Help & support" position="bottom">
            <button
              onClick={() => setShowDiagnosticsModal(true)}
              className="navbar-icon-btn"
            >
              <Info size={16} />
            </button>
          </Tooltip>
          <div className="navbar-divider" />
          {step === 'drop' && (
            <Tooltip text="Open a video file" position="bottom">
              <button
                onClick={() => dropZoneRef.current?.open()}
                className="navbar-text-btn"
              >
                <FolderOpen size={13} />
                <span>Open video</span>
              </button>
            </Tooltip>
          )}
          <Tooltip text="Restore a previous editing session" position="bottom">
            <button
              onClick={openSessionsModal}
              className="navbar-text-btn"
            >
              <Layers size={13} />
              <span>Saved sessions</span>
            </button>
          </Tooltip>
          {proActive ? (
            <Tooltip text="Manage license" position="bottom">
              <button
                onClick={openProModal}
                className="navbar-pro-badge"
                style={{ cursor: 'pointer' }}
              >
                <Sparkles size={10} />
                Pro
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={openProModal}
              className="navbar-upgrade-btn"
            >
              Upgrade
            </button>
          )}
          {step !== 'drop' && (
            <Tooltip text="Discard current video and start over" position="bottom">
              <button
                onClick={handleReset}
                className="navbar-discard-btn"
              >
                <RotateCcw size={13} />
                <span>New video</span>
              </button>
            </Tooltip>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">

        {step === 'drop' && currentFeaturePage && (
          <FeatureLandingPage
            config={currentFeaturePage}
            allPages={FEATURE_PAGES}
            onOpenVideo={() => dropZoneRef.current?.open()}
            onUpgrade={openProModal}
          />
        )}
        {step === 'drop' && !currentFeaturePage && (
          <div
            className="flex-1 flex flex-col items-center justify-start overflow-y-auto"
            style={{
              padding: '44px 24px 64px',
              background: 'var(--bg-page)',
            }}
          >
            <h1 className="hero-item hero-item-1" style={{
              fontSize: 'clamp(42px, 6.5vw, 76px)',
              fontWeight: 700,
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              lineHeight: 1.04,
              letterSpacing: '-0.038em',
              color: 'var(--text-primary)',
              textAlign: 'center',
              maxWidth: 820,
              margin: '0 0 32px 0',
            }}>
              Edit video
              <br />
              <span style={{ color: 'var(--primary)' }}>without uploading anything.</span>
            </h1>

            <p className="hero-item hero-item-2" style={{
              fontSize: 15,
              color: 'var(--text-dim)',
              lineHeight: 1.7,
              textAlign: 'center',
              maxWidth: 520,
              margin: '0 0 18px 0',
              fontWeight: 400,
            }}>
              Designed for lawyers, journalists, and anyone whose footage has to stay on their machine.
            </p>

            <div className="hero-item hero-item-3" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 6,
              marginBottom: 52,
            }}>
              {(['Up to 4 GB', 'Zero uploads', 'No account', 'No install'] as const).map((stat, i) => (
                <span key={i} style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 21,
                  padding: '4px 11px',
                  letterSpacing: '0.01em',
                  whiteSpace: 'nowrap',
                }}>{stat}</span>
              ))}
            </div>

            <div className="action-area hero-item hero-item-4">
              <DropZone ref={dropZoneRef} onFile={handleFile} />
              <ScreenRecordButton onFile={handleFile} autoStart={startRecording} onAutoStarted={clearStartRecording} />
            </div>

            <div id="how-it-works" className="section-reveal"><LandingHowItWorks /></div>

            <div id="features" className="section-reveal"><LandingFeatures /></div>

            <div className="section-reveal"><LandingAudience /></div>

            <div className="section-reveal"><LandingSisterTools /></div>

            <div className="section-reveal"><LandingFAQ /></div>

            <div id="pricing" className="section-reveal"><LandingPricing onUpgrade={openProModal} /></div>

            <div
              className="section-reveal"
              style={{
                width: '100%',
                maxWidth: 820,
                marginTop: 96,
                paddingTop: 40,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <p style={{
                  fontSize: 22,
                  fontWeight: 700,
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.03em',
                  margin: '0 0 6px 0',
                  lineHeight: 1.25,
                }}>
                  Ready to edit your first video?
                </p>
                <p style={{
                  fontSize: 13,
                  color: 'var(--text-dim)',
                  margin: 0,
                  lineHeight: 1.7,
                }}>
                  No signup. No install. Drop your file and start in seconds.
                </p>
              </div>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="navbar-upgrade-btn"
                style={{ height: 40, fontSize: 14, padding: '0 32px', flexShrink: 0 }}
              >
                Start editing now
              </button>
            </div>

            <nav
              aria-label="Free video tools"
              style={{
                width: '100%',
                maxWidth: 820,
                marginTop: 32,
                paddingTop: 24,
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <p style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.56px',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                margin: '0 0 12px 0',
              }}>
                Free browser tools
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
                {FEATURE_PAGES.map(page => (
                  <a
                    key={page.slug}
                    href={`/${page.slug}`}
                    style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none' }}
                    onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    {page.shortLabel}
                  </a>
                ))}
              </div>
            </nav>

            <a
              href="/privacy.html"
              className="hero-item hero-item-6"
              style={{
                marginTop: 20,
                fontSize: 12,
                color: 'var(--text-faint)',
                textDecoration: 'none',
              }}
              onMouseOver={e => (e.currentTarget.style.color = 'var(--primary)')}
              onMouseOut={e => (e.currentTarget.style.color = 'var(--text-faint)')}
            >
              Privacy policy
            </a>

          </div>
        )}

        {step === 'edit' && (
          <>
            <motion.div
              className="flex-1 flex flex-col"
              style={{ background: 'var(--bg-page)', minHeight: '300px' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              <div className="flex-1 flex items-center justify-center p-4 lg:p-8" style={{ minHeight: 0, overflow: 'hidden' }}>
                {/* maxWidth keeps portrait/square previews from overflowing the available vertical space.
                    Available height ≈ 100vh − navbar(65) − padding(64) − VideoControls(80) − toolbar(36) = 245px overhead.
                    Width = availH × (w/h ratio), capped at the original maxWidth per ratio. */}
                <div style={{
                  width: '100%',
                  maxWidth:
                    ratio === '9:16' ? 'min(292px, calc((100vh - 245px) * 9 / 16))'
                    : ratio === '1:1' ? 'min(520px, calc(100vh - 245px))'
                    : ratio === '4:5' ? 'min(416px, calc((100vh - 245px) * 4 / 5))'
                    : '100%',
                }}>
                <VideoPreview
                  videoRef={videoRef}
                  videoUrl={videoUrl}
                  trimStart={trimStart}
                  trimEnd={trimEnd}
                  duration={duration}
                  blurRegions={blurRegions}
                  ratio={ratio}
                  cropMode={cropMode}
                  silenceSegs={silenceSegs}
                  removeSilence={removeSilence}
                  manualCuts={manualCuts}
                  watermark={watermark}
                  isDrawingBlur={isDrawingBlur}
                  onAddBlurRegion={(r) => {
                    setBlurRegions([...blurRegions, { ...r, id: Date.now() }])
                    recordToolUsage('faceBlur').catch(() => {})
                  }}
                  onStopDrawingBlur={() => setIsDrawingBlur(false)}
                  captionGroups={captionGroups}
                  captionStyle={captionStyle}
                />
                </div>
              </div>
              {step === 'edit' && duration > 0 && (
                <div style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:        8,
                  padding:    '7px 16px',
                  background: 'var(--bg-surface)',
                  borderTop:  '1px solid var(--border)',
                  flexShrink: 0,
                }}>
                  <span style={{
                    fontSize:     10,
                    fontFamily:   "'SF Mono','Fira Code',monospace",
                    color:        'var(--primary)',
                    background:   'var(--primary-a10)',
                    border:       '1px solid var(--primary-a20)',
                    padding:      '2px 7px',
                    borderRadius: 10,
                    fontWeight:   500,
                    flexShrink:   0,
                  }}>
                    {ratio}
                  </span>
                  <span style={{
                    fontSize:   10,
                    fontFamily: "'SF Mono','Fira Code',monospace",
                    color:      'var(--text-faint)',
                    flexShrink: 0,
                  }}>
                    {fmtDur(Math.max(0, trimEnd - trimStart))}
                  </span>
                  <div style={{ flex: 1 }} />
                  <Tooltip text="Cut a 1.5s segment at the current playhead (M)" position="top">
                    <button
                      onClick={addManualCutAtPlayhead}
                      style={{
                        display:    'flex',
                        alignItems: 'center',
                        gap:        5,
                        padding:    '5px 11px',
                        borderRadius: 8,
                        background: 'var(--bg-page)',
                        border:     '1px solid var(--border)',
                        color:      'var(--text-muted)',
                        fontSize:   11,
                        fontWeight: 500,
                        cursor:     'pointer',
                      }}
                    >
                      <Scissors size={11} />
                      Split
                    </button>
                  </Tooltip>
                  {hasPip && (
                    <Tooltip text={isPip ? 'Exit floating window' : 'Float video in overlay'} position="top">
                      <button
                        onClick={handlePip}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '5px 11px', borderRadius: 8,
                          background: isPip ? 'var(--primary-a10)' : 'var(--bg-page)',
                          border: `1px solid ${isPip ? 'var(--primary)' : 'var(--border)'}`,
                          color: isPip ? 'var(--primary)' : 'var(--text-muted)',
                          fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        }}
                      >
                        <MonitorPlay size={11} />
                        {isPip ? 'PiP on' : 'PiP'}
                      </button>
                    </Tooltip>
                  )}
                  {hasClipboard && (
                    <Tooltip text={frameCopied ? 'Frame copied to clipboard' : 'Copy current frame'} position="top">
                      <button
                        onClick={handleCopyFrame}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '5px 11px', borderRadius: 8,
                          background: frameCopied ? 'rgba(16,185,129,0.10)' : 'var(--bg-page)',
                          border: `1px solid ${frameCopied ? '#10b981' : 'var(--border)'}`,
                          color: frameCopied ? '#10b981' : 'var(--text-muted)',
                          fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        }}
                      >
                        <Clipboard size={11} />
                        {frameCopied ? 'Copied' : 'Copy frame'}
                      </button>
                    </Tooltip>
                  )}
                </div>
              )}
              {videoToolError && (
                <div
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5"
                  style={{ background: 'rgba(239,68,68,0.07)', color: '#ef4444', borderTop: '1px solid rgba(239,68,68,0.15)' }}
                >
                  <AlertTriangle size={10} style={{ flexShrink: 0 }} />
                  {videoToolError}
                </div>
              )}
            </motion.div>

            <motion.div
              data-cc-editor-sidebar
              className="flex flex-col lg:w-96 xl:w-[420px] border-l"
              style={{ borderColor: 'var(--border)', maxHeight: 'calc(100vh - 65px)' }}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut', delay: 0.06 }}
            >
              {step === 'edit' && (
                <>
                  {/* Workflow progress bar */}
                  {(() => {
                    const tabIds = ['trim','silence-cutter','region-blur','loudness','captions','privacy','watermark','thumbnail','export']
                    const currentIdx = tabIds.indexOf(openSection)
                    return (
                      <div style={{ display: 'flex', gap: 1, height: 3, background: 'var(--bg-surface)', flexShrink: 0, paddingInline: 1, paddingTop: 1 }}>
                        {tabIds.map((tid, i) => (
                          <div
                            key={tid}
                            style={{
                              flex:       1,
                              borderRadius: 2,
                              background: i < currentIdx
                                ? 'var(--primary-a20)'
                                : i === currentIdx
                                ? 'var(--primary)'
                                : 'var(--border-subtle)',
                              transition: 'background 0.25s ease',
                            }}
                          />
                        ))}
                      </div>
                    )
                  })()}

                  {/* Tool tab strip */}
                  <div
                    style={{
                      display:             'grid',
                      gridTemplateColumns: 'repeat(9, 1fr)',
                      borderBottom:        '1px solid var(--border)',
                      background:          'var(--bg-surface)',
                      flexShrink:          0,
                    }}
                  >
                    {([
                      { id: 'trim',           icon: <Scissors size={12} />, label: 'Trim',     badge: fmtDur(Math.max(0, trimEnd - trimStart)) },
                      { id: 'silence-cutter', icon: <VolumeX size={12} />,  label: 'Silence',  badge: removeSilence && silenceSegs.length > 0 ? String(silenceSegs.length) : undefined },
                      { id: 'region-blur',    icon: <EyeOff size={12} />,   label: 'Blur',     badge: blurRegions.length > 0 ? String(blurRegions.length) : undefined },
                      { id: 'loudness',       icon: <Volume2 size={12} />,  label: 'Audio',    badge: loudness !== 'off' ? loudness : undefined },
                      { id: 'captions',       icon: <Captions size={12} />, label: 'Captions', badge: words.length > 0 ? `${words.length}w` : undefined },
                      { id: 'privacy',        icon: <Lock size={12} />,     label: 'Privacy',  badge: stripMeta ? 'on' : undefined },
                      { id: 'watermark',      icon: <Sparkles size={12} />, label: 'Brand',    badge: undefined },
                      { id: 'thumbnail',      icon: <Camera size={12} />,   label: 'Frame',    badge: undefined },
                      { id: 'export',         icon: <Download size={12} />, label: 'Export',   badge: undefined },
                    ] as { id: string; icon: React.ReactNode; label: string; badge?: string }[]).map(({ id, icon, label, badge }) => (
                      <Tooltip key={id} text={label} position="bottom">
                        <button
                          onClick={() => setOpenSection(id)}
                          style={{
                            display:        'flex',
                            flexDirection:  'column',
                            alignItems:     'center',
                            justifyContent: 'center',
                            gap:            3,
                            padding:        '9px 2px 7px',
                            border:         'none',
                            borderBottom:   `2px solid ${openSection === id ? 'var(--primary)' : 'transparent'}`,
                            background:     openSection === id ? 'var(--primary-a8)' : 'none',
                            color:          openSection === id ? 'var(--primary)' : 'var(--text-faint)',
                            cursor:         'pointer',
                            transition:     'color 0.15s, background 0.15s, border-color 0.15s',
                            position:       'relative',
                            width:          '100%',
                          }}
                        >
                          {icon}
                          <span style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '0.03em', lineHeight: 1 }}>
                            {label}
                          </span>
                          {badge && (
                            <span style={{
                              position:     'absolute',
                              top:          4,
                              right:        2,
                              fontSize:     7,
                              fontWeight:   700,
                              background:   'var(--primary)',
                              color:        '#fff',
                              borderRadius: 3,
                              padding:      '1px 2px',
                              lineHeight:   1.2,
                              maxWidth:     28,
                              overflow:     'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace:   'nowrap',
                            }}>
                              {badge}
                            </span>
                          )}
                        </button>
                      </Tooltip>
                    ))}
                  </div>

                  {/* Banners */}
                  {(!ffLoaded || sessionBanner || sessionSaveError) && (
                    <div className="flex flex-col gap-2 px-5 pt-4" style={{ flexShrink: 0 }}>
                      {!ffLoaded && (
                        <div
                          className="p-3.5 rounded-xl text-xs flex gap-2 border"
                          style={{ borderColor: 'var(--primary-a20)', background: 'var(--primary-a4)' }}
                        >
                          <Info size={14} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }} />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Downloading processing engine</span>
                            <span style={{ color: 'var(--text-muted)' }}>One-time download (~37 MB). After this, the app works fully offline.</span>
                          </div>
                        </div>
                      )}
                      {sessionBanner && (
                        <div
                          className="p-3.5 rounded-xl text-xs flex gap-2 border"
                          style={{ borderColor: 'var(--primary-a20)', background: 'var(--primary-a4)', color: 'var(--primary)' }}
                        >
                          <Check size={14} className="flex-shrink-0 mt-0.5" />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Session restored</span>
                            <span style={{ color: 'var(--text-muted)' }}>Your trim and settings are back.</span>
                          </div>
                        </div>
                      )}
                      {sessionSaveError && (
                        <div
                          className="p-3.5 rounded-xl text-xs flex gap-2 border"
                          style={{ borderColor: 'rgba(245, 158, 11, 0.15)', background: 'rgba(245, 158, 11, 0.02)', color: '#f59e0b' }}
                        >
                          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold">Auto-save suspended</span>
                            <span style={{ color: 'var(--text-muted)' }}>{sessionSaveError}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Active panel */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-5">

                      {openSection === 'trim' && (
                        <Section icon={<Scissors size={13} />} label="Trim" tooltip="Drag the handles to set your clip's in and out points" badge={fmtDur(Math.max(0, trimEnd - trimStart))}>
                          <TrimSlider
                            duration={duration}
                            file={file}
                            start={trimStart}
                            end={trimEnd}
                            onChange={(s, e) => { setTrimStart(s); setTrimEnd(e) }}
                            silenceMarks={removeSilence ? silenceSegs : []}
                            manualMarks={manualCuts}
                          />

                          <div className="flex flex-col gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Manual Timeline Cuts</span>
                              <Tooltip text="Mark a ~1.5s segment at the current position to be removed on export" position="left">
                                <button
                                  onClick={addManualCutAtPlayhead}
                                  className="px-2.5 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer"
                                  style={{ background: 'var(--bg-surface)', color: 'var(--primary)', border: '1px solid var(--border)' }}
                                >
                                  Cut at playhead
                                </button>
                              </Tooltip>
                            </div>

                            {(manualCuts.length > 0 || manualCutsHistoryRef.current.length > 0 || manualCutsRedoRef.current.length > 0) && (
                              <div className="flex gap-2">
                                <button
                                  onClick={undoLastManualCut}
                                  disabled={manualCutsHistoryRef.current.length === 0}
                                  className="px-2 py-1 rounded text-xs cursor-pointer transition-colors"
                                  style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                                  title="Undo (Ctrl+Z)"
                                >
                                  Undo
                                </button>
                                <button
                                  onClick={redoLastManualCut}
                                  disabled={manualCutsRedoRef.current.length === 0}
                                  className="px-2 py-1 rounded text-xs cursor-pointer transition-colors"
                                  style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                                  title="Redo (Ctrl+Shift+Z)"
                                >
                                  Redo
                                </button>
                                <button
                                  onClick={clearManualCuts}
                                  disabled={manualCuts.length === 0}
                                  className="px-2 py-1 rounded text-xs cursor-pointer transition-colors"
                                  style={{ background: 'var(--bg-surface)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)' }}
                                  title="Remove all manual cuts"
                                >
                                  Clear all
                                </button>
                              </div>
                            )}

                            {manualCuts.length === 0 ? (
                              <p className="text-xs italic" style={{ color: 'var(--text-faint)' }}>No manual cuts added yet. Seek to any position and click "Cut at playhead".</p>
                            ) : (
                              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                                {manualCuts.map((cut, idx) => (
                                  <div key={idx} className="flex items-center gap-2 p-2 rounded border text-xs" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                    <span className="font-mono" style={{ color: '#ef4444' }}>#{idx + 1}</span>
                                    <div className="flex items-center gap-1 flex-1">
                                      <span style={{ color: 'var(--text-faint)' }}>Start:</span>
                                      <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max={trimEnd - trimStart}
                                        value={parseFloat(cut.start.toFixed(1))}
                                        onChange={e => {
                                          const val = parseFloat(e.target.value) || 0
                                          const updated = [...manualCuts]
                                          updated[idx] = { ...cut, start: val }
                                          setManualCuts(updated.sort((a, b) => a.start - b.start))
                                        }}
                                        className="w-14 border text-center font-mono py-0.5 rounded outline-none focus:border-primary"
                                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                      />
                                      <span className="ml-1" style={{ color: 'var(--text-faint)' }}>End:</span>
                                      <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max={trimEnd - trimStart}
                                        value={parseFloat(cut.end.toFixed(1))}
                                        onChange={e => {
                                          const val = parseFloat(e.target.value) || 0
                                          const updated = [...manualCuts]
                                          updated[idx] = { ...cut, end: val }
                                          setManualCuts(updated.sort((a, b) => a.start - b.start))
                                        }}
                                        className="w-14 border text-center font-mono py-0.5 rounded outline-none focus:border-primary"
                                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                      />
                                    </div>
                                    <button
                                      onClick={() => deleteManualCut(idx)}
                                      className="p-1 rounded transition-colors cursor-pointer text-sm font-semibold hover:text-[#ef4444]"
                                      style={{ color: 'var(--text-faint)' }}
                                      title="Remove cut"
                                    >
                                      &times;
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </Section>
                      )}

                      {openSection === 'captions' && (
                        <Section icon={<Captions size={13} />} label="Captions" tooltip="Auto-transcribe speech or type a transcript, then style word-by-word captions" badge={words.length > 0 ? `${words.length} words` : undefined}>
                          <div className="flex flex-col gap-4">

                            {/* Step 1: Transcribe */}
                            <TranscribeButton
                              videoFile={file}
                              videoDuration={duration}
                              onTranscribed={ws => { setWords(ws); if (ws.length > 0) recordToolUsage('captions').catch(() => {}) }}
                              onResult={(r, lang) => { setTranscriptResult(r); setTranscriptLanguage(lang) }}
                            />

                            {/* Step 2: Edit words */}
                            <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                            <CaptionEditor
                              words={words}
                              onWordsChange={setWords}
                              videoDuration={duration}
                            />

                            {/* Step 3: Style */}
                            <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                            <CaptionStylePanel
                              style={captionStyle}
                              onChange={setCaptionStyle}
                            />

                            {/* Step 4: AI analysis — appears once transcription has run */}
                            {transcriptResult && (
                              <>
                                <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                                <div>
                                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Hook Score</p>
                                  <HookScorer transcript={transcriptResult} onProGate={!proActive ? openProModal : undefined} />
                                </div>

                                <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                                <div>
                                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Filler Words</p>
                                  <FillerWordPanel
                                    transcript={transcriptResult}
                                    removedFillers={removedFillers}
                                    onToggle={setRemovedFillers}
                                    language={transcriptLanguage}
                                    onProGate={!proActive ? openProModal : undefined}
                                  />
                                </div>

                                <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                                <div>
                                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Pace Analyzer</p>
                                  <PaceAnalyzer
                                    transcript={transcriptResult}
                                    onSeek={t => { if (videoRef.current) videoRef.current.currentTime = t }}
                                    onProGate={!proActive ? openProModal : undefined}
                                  />
                                </div>

                                <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                                <div>
                                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>B-Roll Gaps</p>
                                  <BRollGapDetector
                                    transcript={transcriptResult}
                                    trimStart={trimStart}
                                    trimEnd={trimEnd}
                                    silenceSegs={silenceSegs}
                                    onSeek={t => { if (videoRef.current) videoRef.current.currentTime = t }}
                                    onProGate={!proActive ? openProModal : undefined}
                                  />
                                </div>

                                <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                                <div>
                                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Chapter Generator</p>
                                  <ChapterGenerator transcript={transcriptResult} onProGate={!proActive ? openProModal : undefined} />
                                </div>

                                <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                                <div>
                                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>AI Assist</p>
                                  <AIAssistPanel transcript={transcriptResult} />
                                </div>
                              </>
                            )}

                          </div>
                        </Section>
                      )}

                      {openSection === 'export' && (
                        <Section icon={<Download size={13} />} label="Export" tooltip="Render and download your video with captions baked in">
                          <div className="flex flex-col gap-5">

                            <PreExportReport
                              videoWidth={videoWidth}
                              videoHeight={videoHeight}
                              trimDuration={Math.max(0, trimEnd - trimStart)}
                              fileSize={file?.size || 0}
                              hasAudio={hasAudio}
                            />

                            <ExportPanel
                              videoRef={videoRef}
                              captionGroups={captionGroups}
                              captionStyle={captionStyle}
                              trimStart={trimStart}
                              trimEnd={trimEnd}
                              cropMode={cropMode}
                              blurRegions={blurRegions}
                              watermark={watermark}
                              manualCuts={manualCuts}
                              silenceSegs={silenceSegs}
                              removeSilence={removeSilence}
                              ratio={ratio}
                              onRatioChange={r => setRatio(r as Ratio)}
                              fillerCuts={fillerCuts}
                              onExported={setExportedSize}
                              loudnessTarget={loudness}
                              denoiseAudio={denoiseAudio}
                              isPro={proActive}
                            />

                            {exportedSize > 0 && (
                              <>
                                <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                                <div>
                                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Export Summary</p>
                                  <PostExportReport originalSize={file?.size || 0} exportedSize={exportedSize} />
                                </div>
                              </>
                            )}

                            <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                            <div>
                              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Batch Export</p>
                              <BatchExportPanel
                                running={batchRunning}
                                progress={batchProgress}
                                disabled={!file || !videoRef.current}
                                onProGate={!proActive ? openProModal : undefined}
                                onClick={async () => {
                                  if (!videoRef.current || !file) return
                                  recordToolUsage('batchExport').catch(() => {})
                                  setBatchRunning(true)
                                  setBatchProgress([])
                                  try {
                                    await batchExport(
                                      videoRef.current,
                                      captionGroups,
                                      captionStyle,
                                      trimStart,
                                      trimEnd,
                                      cropMode,
                                      blurRegions,
                                      watermark,
                                      [...manualCuts, ...fillerCuts],
                                      silenceSegs,
                                      removeSilence,
                                      file.name.replace(/\.[^.]+$/, ''),
                                      p => setBatchProgress(p),
                                    )
                                  } finally {
                                    setBatchRunning(false)
                                  }
                                }}
                              />
                            </div>

                            <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                            <div>
                              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Export Presets</p>
                              <ExportPresets
                                ratio={ratio as '16:9' | '9:16' | '1:1' | '4:5' | 'Original'}
                                cropMode={cropMode}
                                stripMeta={stripMeta}
                                watermark={watermark}
                                onApply={(preset: ExportPreset) => {
                                  setRatio(preset.ratio as Ratio)
                                  setCropMode(preset.cropMode)
                                  setStripMeta(preset.stripMeta)
                                }}
                                onProGate={!proActive ? openProModal : undefined}
                              />
                            </div>
                          </div>
                        </Section>
                      )}

                      {openSection === 'silence-cutter' && (
                        <Section icon={<VolumeX size={13} />} label="Silence cutter" tooltip="Auto-detect and remove silent gaps from the clip" badge={removeSilence ? (silenceSegs.length > 0 ? `${silenceSegs.length} cut${silenceSegs.length !== 1 ? 's' : ''}` : 'on') : 'off'} headerAction={<HeaderToggle checked={removeSilence} onToggle={e => { e.stopPropagation(); setRemoveSilence(v => !v) }} label="Enable silence removal" />}>
                          <SilenceCutterPanel
                            file={file}
                            trimStart={trimStart}
                            trimEnd={trimEnd}
                            hasAudio={hasAudio}
                            removeSilence={removeSilence}
                            onToggle={setRemoveSilence}
                            onSegments={handleSilenceSegments}
                            scanState={silenceScanState}
                            onScanState={setSilenceScanState}
                          />
                          {silenceSegsStale && (
                            <div className="flex items-start gap-1.5 px-2 py-1.5 rounded text-xs" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
                              <AlertTriangle size={11} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                              <span style={{ color: '#f59e0b' }}>Trim bounds changed. Re-scan to update silence detection.</span>
                            </div>
                          )}
                          {!silenceSegsStale && silenceSegs.length > 0 && silenceSourceKey !== null && silenceSourceKey !== (file ? `${file.name}__${file.size}` : null) && (
                            <div className="flex items-start gap-1.5 px-2 py-1.5 rounded text-xs" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}>
                              <AlertTriangle size={11} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                              <span style={{ color: '#ef4444' }}>These silence cuts were scanned from a different file. Re-run detection to update them.</span>
                            </div>
                          )}
                        </Section>
                      )}

                      {openSection === 'loudness' && (
                        <Section icon={<Volume2 size={13} />} label="Loudness" tooltip="Normalize audio levels to a broadcast standard" badge={loudness === 'off' ? 'off' : loudness} headerAction={<HeaderToggle checked={denoiseAudio} onToggle={e => { e.stopPropagation(); setDenoiseAudio(v => !v) }} label="Denoise audio" />}>
                          <LoudnessPanel
                            target={loudness}
                            onChange={setLoudness}
                            denoise={denoiseAudio}
                          />
                        </Section>
                      )}

                      {openSection === 'region-blur' && (
                        <Section icon={<EyeOff size={13} />} label="Region blur" tooltip="Draw a blur box over faces or sensitive areas" badge={blurRegions.length > 0 ? `${blurRegions.length} region${blurRegions.length !== 1 ? 's' : ''}` : undefined}>
                          <FaceBlurPanel
                            regions={blurRegions}
                            onChange={setBlurRegions}
                            isDrawing={isDrawingBlur}
                            onStartDrawing={() => setIsDrawingBlur(true)}
                            onProGate={!proActive ? openProModal : undefined}
                            formState={blurFormState}
                            onFormState={setBlurFormState}
                          />
                        </Section>
                      )}

                      {openSection === 'privacy' && (
                        <Section icon={<Lock size={13} />} label="Privacy and metadata" tooltip="Strip GPS, camera model and other hidden metadata" badge={stripMeta ? 'stripping' : 'off'} headerAction={<HeaderToggle checked={stripMeta} onToggle={e => { e.stopPropagation(); setStripMeta(v => !v) }} label="Strip metadata on export" />}>
                          {meta
                            ? <MetadataReport meta={meta} strip={stripMeta} onToggleStrip={setStripMeta} />
                            : metaScanFailed
                              ? <p className="text-xs" style={{ color: '#ef4444' }}>Scan failed. Metadata state unknown. Strip on export is recommended.</p>
                              : <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Scanning file...</p>
                          }
                        </Section>
                      )}

                      {openSection === 'watermark' && (
                        <Section icon={<Sparkles size={13} />} label="Watermark" tooltip="Overlay a logo or image on the exported video">
                          <WatermarkPanel config={watermark} onChange={setWatermark} onProGate={!proActive ? openProModal : undefined} />
                        </Section>
                      )}

                      {openSection === 'thumbnail' && (
                        <Section icon={<Camera size={13} />} label="Thumbnail" tooltip="Extract and download a still frame as a JPG">
                          <ThumbnailExtractor
                            videoRef={videoRef}
                            trimStart={trimStart}
                            trimEnd={trimEnd}
                          />
                        </Section>
                      )}

                    </div>
                  </div>

                  {/* Footer */}
                  <div
                    className="px-5"
                    style={{ borderTop: '1px solid var(--border-subtle)', flexShrink: 0, padding: '7px 20px', display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}
                  >
                    {file && <FileSizeReadout size={file.size} />}
                    <p className="text-xs" style={{ color: 'var(--text-dim)', margin: 0 }}>
                      All processing runs locally. No file ever leaves your device.
                    </p>
                  </div>
                </>
              )}

            </motion.div>
          </>
        )}
      </main>

      {showProModal && (
        <ProUnlockModal
          onClose={() => setShowProModal(false)}
          onActivated={() => setProActive(true)}
          onDeactivated={() => setProActive(false)}
          proStatus={getProStatus()}
          initialView={proModalView}
        />
      )}

      {showSessionsModal && (
        <SessionsModal
          sessions={savedSessions}
          pendingSession={pendingLoadSession}
          currentFile={file}
          onLoad={handleLoadSession}
          onDelete={handleDeleteSession}
          onClose={() => { setShowSessionsModal(false); setPendingLoadSession(null) }}
          onSelectFile={e => {
            const f = e.target.files?.[0]
            if (f && pendingLoadSession) {
              const parts = pendingLoadSession.fileKey.split('__')
              const reqName = parts[0]
              const reqSize = parts[1] ? parseInt(parts[1]) : 0
              if (f.name !== reqName || f.size !== reqSize) {
                alert(`Selected file does not match the required session video.

Expected: ${reqName} (${formatBytes(reqSize)})
Selected: ${f.name} (${formatBytes(f.size)})`)
                return
              }
              handleFile(f)
            }
          }}
        />
      )}
      {updateState === 'waiting' && (
        <UpdateBanner onUpdate={applyUpdate} />
      )}

      {extensionError && (
        <div className="card" style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 60, padding: '16px', maxWidth: '400px', width: 'calc(100vw - 32px)',
          display: 'flex', gap: '12px', alignItems: 'flex-start',
          borderLeft: '4px solid var(--danger)'
        }}>
          <AlertCircle size={20} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 600, fontSize: '0.9rem' }}>Extension Fetch Failed</p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{extensionError}</p>
          </div>
          <button onClick={clearExtensionError} style={{
            background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, flexShrink: 0
          }}>
            <X size={15} />
          </button>
        </div>
      )}

      {installState === 'available' && (
        <InstallPrompt onInstall={triggerInstall} onDismiss={dismissInstall} />
      )}

      {installState === 'installed' && (
        <PostInstallTip />
      )}

      {showShortcutsModal && (
        <KeyboardShortcutsModal onClose={() => setShowShortcutsModal(false)} />
      )}

      {showDiagnosticsModal && (
        <DiagnosticsModal onClose={() => setShowDiagnosticsModal(false)} />
      )}

      {windowDragging && (
        <div
          className="drag-overlay"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            dragCounter.current = 0
            setWindowDragging(false)
            const f = e.dataTransfer.files[0]
            if (f && (f.type.startsWith('video/') || f.type.startsWith('audio/'))) handleFile(f)
          }}
        >
          <div className="drag-overlay-card">
            <FolderOpen size={30} color="var(--primary)" />
            <p className="drag-overlay-title">
              {step === 'drop' ? 'Drop your file' : 'Drop to replace file'}
            </p>
            <p className="drag-overlay-sub">MP4, MOV, WebM, MKV, MP3, WAV, M4A and more</p>
          </div>
        </div>
      )}

      {extensionLoading && (
        <div className="drag-overlay" style={{ zIndex: 100 }}>
          <div className="drag-overlay-card" style={{ gap: '16px' }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', border: '3px solid var(--primary-a12)',
              borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite'
            }} />
            <div style={{ textAlign: 'center' }}>
              <p className="drag-overlay-title">Fetching Media</p>
              <p className="drag-overlay-sub">Downloading video from extension...</p>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}
    </div>
  )
}
