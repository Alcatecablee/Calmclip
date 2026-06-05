import { useEffect, useRef, useState, useCallback } from 'react'

export type PWAInstallState = 'unavailable' | 'available' | 'installed' | 'dismissed'
export type PWAUpdateState  = 'idle' | 'waiting' | 'updating'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  prompt(): Promise<void>
}

interface UsePWAReturn {
  installState:    PWAInstallState
  updateState:     PWAUpdateState
  isStandalone:    boolean
  triggerInstall:  () => Promise<void>
  dismissInstall:  () => void
  applyUpdate:     () => void
  launchFile:      File | null
  clearLaunchFile: () => void
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
        if (file.type.startsWith('video/')) setLaunchFile(file)
        else console.error('[CalmClip] launchQueue: not a video file:', file.type)
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
        const buffer = await resp.arrayBuffer()
        const type   = resp.headers.get('Content-Type') ?? 'video/mp4'
        const name   = resp.headers.get('X-File-Name')  ?? 'shared-video.mp4'
        if (!type.startsWith('video/')) {
          console.error('[CalmClip] Share target: unexpected MIME type:', type)
          return
        }
        setLaunchFile(new File([buffer], name, { type }))
        await cache.delete(SHARE_KEY)
      } catch (err) {
        console.error('[CalmClip] Share target: failed to read cached file:', err)
      }
    }).catch(err => {
      console.error('[CalmClip] Share target: cache open failed:', err)
    })
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

  const clearLaunchFile = useCallback(() => setLaunchFile(null), [])

  return {
    installState,
    updateState,
    isStandalone,
    triggerInstall,
    dismissInstall,
    applyUpdate,
    launchFile,
    clearLaunchFile,
  }
}
