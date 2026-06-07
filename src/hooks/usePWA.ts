import { useEffect, useRef, useState, useCallback } from 'react'

export type PWAInstallState = 'unavailable' | 'available' | 'installed' | 'dismissed'
export type PWAUpdateState  = 'idle' | 'waiting' | 'updating'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  prompt(): Promise<void>
}

interface UsePWAReturn {
  installState:        PWAInstallState
  updateState:         PWAUpdateState
  isStandalone:        boolean
  triggerInstall:      () => Promise<void>
  dismissInstall:      () => void
  applyUpdate:         () => void
  launchFile:          File | null
  clearLaunchFile:     () => void
  extensionError:      string | null
  clearExtensionError: () => void
  extensionLoading:    boolean
  startRecording:      boolean
  clearStartRecording: () => void
}

const DISMISS_KEY  = 'calmclip-install-dismissed'
const SHARE_CACHE  = 'calmclip-share'
const SHARE_KEY    = '/share-data'

export function usePWA(): UsePWAReturn {
  const promptRef      = useRef<BeforeInstallPromptEvent | null>(null)
  const regRef         = useRef<ServiceWorkerRegistration | null>(null)
  // Track update state in a ref so controllerchange handler can read it
  // without causing a stale closure, and without calling reload inside a
  // setState updater (which React may invoke more than once in StrictMode).
  const updateStateRef = useRef<PWAUpdateState>('idle')

  const [installState, setInstallState] = useState<PWAInstallState>('unavailable')
  const [updateState,  _setUpdateState]  = useState<PWAUpdateState>('idle')
  const [launchFile,   setLaunchFile]   = useState<File | null>(null)
  const [extensionError, setExtensionError] = useState<string | null>(null)
  const [extensionLoading, setExtensionLoading] = useState(false)
  const [startRecording, setStartRecording] = useState(false)

  const setUpdateState = useCallback((next: PWAUpdateState) => {
    updateStateRef.current = next
    _setUpdateState(next)
  }, [])

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
     (window.navigator as Navigator & { standalone?: boolean }).standalone === true)

  // Mark as installed when running in standalone mode
  useEffect(() => {
    if (isStandalone) setInstallState('installed')
  }, [isStandalone])

  // Capture beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      promptRef.current = e as BeforeInstallPromptEvent
      if (!localStorage.getItem(DISMISS_KEY) && !isStandalone) {
        setInstallState('available')
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isStandalone])

  // Detect when app is installed via OS
  useEffect(() => {
    const handler = () => setInstallState('installed')
    window.addEventListener('appinstalled', handler)
    return () => window.removeEventListener('appinstalled', handler)
  }, [])

  // Service Worker update detection
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_WAITING') setUpdateState('waiting')
    }
    navigator.serviceWorker.addEventListener('message', onMessage)

    navigator.serviceWorker.ready.then(reg => {
      regRef.current = reg
      if (reg.waiting) setUpdateState('waiting')

      reg.addEventListener('updatefound', () => {
        const worker = reg.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateState('waiting')
          }
        })
      })
    })

    // controllerchange fires when the new SW takes control. If the user
    // clicked "Update now" (updateStateRef === 'updating'), reload the page.
    // Reading from the ref avoids a stale closure and avoids calling reload
    // inside a setState updater.
    const onControllerChange = () => {
      if (updateStateRef.current === 'updating') {
        window.location.reload()
      } else {
        setUpdateState('idle')
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [setUpdateState])

  // File Handling API: video opened from the OS desktop via installed PWA
  useEffect(() => {
    if (!('launchQueue' in window)) return
    type LQ = { setConsumer: (cb: (p: { files: FileSystemFileHandle[] }) => void) => void }
    ;(window as Window & { launchQueue: LQ }).launchQueue.setConsumer(async params => {
      if (!params.files?.length) return
      try {
        const file = await params.files[0].getFile()
        if (file.type.startsWith('video/') || file.type.startsWith('audio/')) setLaunchFile(file)
        else console.error('[CalmClip] launchQueue: unsupported file type:', file.type)
      } catch (err) {
        console.error('[CalmClip] launchQueue file access failed:', err)
      }
    })
  }, [])

  // Share Target: SW handled the POST, cached the blob at /share-data,
  // then redirected here with ?share-target. Read the cached blob and open it.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (!params.has('share-target')) return
    history.replaceState({}, '', location.pathname)

    if (!('caches' in window)) {
      console.error('[CalmClip] Cache API unavailable; cannot read shared file')
      return
    }
    caches.open(SHARE_CACHE).then(async cache => {
      const resp = await cache.match(SHARE_KEY)
      if (!resp) {
        console.error('[CalmClip] Share target: no cached file found')
        return
      }
      try {
        const blob   = await resp.blob()
        const type   = resp.headers.get('Content-Type') ?? 'video/mp4'
        const name   = resp.headers.get('X-File-Name')  ?? 'shared-video.mp4'
        if (!type.startsWith('video/') && !type.startsWith('audio/')) {
          console.error('[CalmClip] Share target: unexpected MIME type:', type)
          return
        }
        setLaunchFile(new File([blob], name, { type }))
        await cache.delete(SHARE_KEY)
      } catch (err) {
        console.error('[CalmClip] Share target: failed to read cached file:', err)
      }
    }).catch(err => {
      console.error('[CalmClip] Share target: cache open failed:', err)
    })
  }, [])

  // Extension API v0 / Taskbar shortcuts / Extension Stream
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const source = params.get('source')
    
    if (source === 'shortcut-record') {
      setStartRecording(true)
      params.delete('source')
      const newSearch = params.toString() ? `?${params.toString()}` : ''
      history.replaceState({}, '', location.pathname + newSearch)
      return
    }

    if (source === 'shortcut-edit' || source === 'file-handler' || source === 'pwa') {
      params.delete('source')
      const newSearch = params.toString() ? `?${params.toString()}` : ''
      history.replaceState({}, '', location.pathname + newSearch)
      return
    }

    if (source === 'extension_stream') {
      setExtensionLoading(true)

      let loadingTimer: ReturnType<typeof setTimeout> | null = null

      function finishStream() {
        if (loadingTimer !== null) { clearTimeout(loadingTimer); loadingTimer = null }
        params.delete('source')
        const newSearch = params.toString() ? `?${params.toString()}` : ''
        history.replaceState({}, '', location.pathname + newSearch)
        window.removeEventListener('message', handleMessage)
      }
      
      const handleMessage = (e: MessageEvent) => {
        if (!e.data) return
        if (e.origin !== location.origin) return

        if (e.data.type === 'CALMCLIP_BLOB_READY') {
          const file = new File([e.data.blob], e.data.name || 'streamed-video.mp4', {
            type: e.data.blob.type || 'video/mp4'
          })
          setLaunchFile(file)
          setExtensionLoading(false)
          finishStream()
        }
        else if (e.data.type === 'CALMCLIP_STREAM_ERROR') {
          setExtensionError(e.data.error || 'Failed to stream video.')
          setExtensionLoading(false)
          finishStream()
        }
      }

      window.addEventListener('message', handleMessage)

      // If no message arrives within 60 s the SW or content script is dead.
      loadingTimer = setTimeout(() => {
        loadingTimer = null
        setExtensionError('The video stream timed out. Please try again.')
        setExtensionLoading(false)
        finishStream()
      }, 60_000)
      
      // Tell the receiver script that the app is hydrated and listening.
      // This solves the race condition where the blob finished downloading
      // before React finished booting up.
      window.postMessage({ type: 'CALMCLIP_APP_READY' }, '*')
      return
    }

    if (source !== 'extension') return

    const errorParam = params.get('error')
    const videoParam = params.get('video')

    // Clean only extension-related params from the URL so refresh doesn't re-trigger
    params.delete('source')
    params.delete('error')
    params.delete('video')
    const newSearch = params.toString() ? `?${params.toString()}` : ''
    history.replaceState({}, '', location.pathname + newSearch)

    if (errorParam) {
      setExtensionError(errorParam)
      return
    }

    if (!videoParam) return

    async function fetchExtensionMedia(url: string) {
      setExtensionLoading(true)
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const blob = await res.blob()
        const type = blob.type || 'video/mp4' // fallback if server doesn't send content-type
        const name = url.split('/').pop()?.split('?')[0] || 'extension-media.mp4'

        setLaunchFile(new File([blob], name, { type }))
      } catch (err) {
        console.error('[CalmClip] Extension direct fetch failed:', err)
        setExtensionError(
          'Could not fetch the video directly. The website might be blocking external access (CORS). ' +
          'Try downloading the video first, then drop it into CalmClip.'
        )
      } finally {
        setExtensionLoading(false)
      }
    }
    fetchExtensionMedia(videoParam)
  }, [])

  const triggerInstall = useCallback(async () => {
    const prompt = promptRef.current
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setInstallState('installed')
    } else {
      setInstallState('dismissed')
      localStorage.setItem(DISMISS_KEY, '1')
    }
    promptRef.current = null
  }, [])

  const dismissInstall = useCallback(() => {
    setInstallState('dismissed')
    localStorage.setItem(DISMISS_KEY, '1')
  }, [])

  const applyUpdate = useCallback(() => {
    const reg = regRef.current
    if (!reg?.waiting) return
    setUpdateState('updating')
    reg.waiting.postMessage({ type: 'SKIP_WAITING' })
  }, [setUpdateState])

  const clearLaunchFile      = useCallback(() => setLaunchFile(null), [])
  const clearExtensionError  = useCallback(() => setExtensionError(null), [])
  const clearStartRecording  = useCallback(() => setStartRecording(false), [])

  return {
    installState,
    updateState,
    isStandalone,
    triggerInstall,
    dismissInstall,
    applyUpdate,
    launchFile,
    clearLaunchFile,
    extensionError,
    clearExtensionError,
    extensionLoading,
    startRecording,
    clearStartRecording,
  }
}
