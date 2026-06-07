// CalmClip - Extension Chunked Stream Receiver
// Injected into calmclip.video/* and localhost/*

console.log('[CalmClip Receiver] Injected')

if (location.search.includes('source=extension_stream')) {
  console.log('[CalmClip Receiver] Connecting to extension stream...')

  const port = chrome.runtime.connect({ name: 'calmclip_stream' })
  
  let mimeType = 'video/mp4'
  let fileName = 'streamed-video.mp4'

  let fileHandle = null
  let writable = null
  let writeQueue = Promise.resolve()
  // Set to true on any fatal error so chunk/end handlers no-op immediately.
  let hasError = false

  async function opfsCleanup() {
    if (writable) {
      try { await writable.close() } catch (_) {}
      writable = null
    }
    try {
      const root = await navigator.storage.getDirectory()
      await root.removeEntry('calmclip-temp-stream')
    } catch (_) {}
  }

  port.onMessage.addListener((msg) => {
    if (msg.error) {
      hasError = true
      console.error('[CalmClip Receiver] Stream error:', msg.error)
      window.postMessage({ type: 'CALMCLIP_STREAM_ERROR', error: msg.error }, '*')
      writeQueue = writeQueue.then(opfsCleanup)
      return
    }

    if (msg.type === 'start') {
      mimeType = msg.mimeType
      fileName = msg.name
      console.log('[CalmClip Receiver] Stream started:', fileName, mimeType)
      
      writeQueue = writeQueue.then(async () => {
        try {
          const root = await navigator.storage.getDirectory()
          fileHandle = await root.getFileHandle('calmclip-temp-stream', { create: true })
          writable = await fileHandle.createWritable()
        } catch (err) {
          hasError = true
          console.error('[CalmClip Receiver] OPFS error:', err)
          window.postMessage({ type: 'CALMCLIP_STREAM_ERROR', error: 'Local file system access failed.' }, '*')
        }
      })
    } 
    else if (msg.type === 'chunk') {
      if (hasError) return
      writeQueue = writeQueue.then(async () => {
        if (writable) {
          await writable.write(new Uint8Array(msg.data))
        }
      })
    } 
    else if (msg.type === 'end') {
      if (hasError) return
      writeQueue = writeQueue.then(async () => {
        console.log('[CalmClip Receiver] Stream ended, assembling File from OPFS...')
        if (writable) {
          await writable.close()
          writable = null
          const file = await fileHandle.getFile()

          // Remove the OPFS temp entry now that we have the File handle.
          try {
            const root = await navigator.storage.getDirectory()
            await root.removeEntry('calmclip-temp-stream')
          } catch (_) {}

          console.log(`[CalmClip Receiver] File ready: ${file.size} bytes`)
          
          const payload = { 
            type: 'CALMCLIP_BLOB_READY', 
            blob: file, 
            name: fileName 
          }
          
          // Handoff to the React app
          window.postMessage(payload, '*')
          
          // The React app may not have hydrated yet when this completes.
          // Listen for a ready ping and resend if necessary.
          // Remove the listener after the first match so stale data is never re-posted.
          const onAppReady = (e) => {
            if (e.data?.type === 'CALMCLIP_APP_READY') {
              clearTimeout(appReadyTimer)
              window.removeEventListener('message', onAppReady)
              window.postMessage(payload, '*')
            }
          }
          window.addEventListener('message', onAppReady)
          // Remove the listener after 5 s regardless, so it never leaks
          // when the app was already hydrated before the stream finished.
          const appReadyTimer = setTimeout(() => {
            window.removeEventListener('message', onAppReady)
          }, 5000)
        }
      })
    }
  })

  port.onDisconnect.addListener(() => {
    console.log('[CalmClip Receiver] Port disconnected.')
    // If the port drops mid-transfer (SW killed, tab closed, network error),
    // close and remove any open OPFS writable so no orphaned file is left.
    writeQueue = writeQueue.then(opfsCleanup)
  })
}
