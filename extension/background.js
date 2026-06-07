// CalmClip Extension v0 - Background Service Worker
// Registers context menu items for video/audio elements and media file links.
// On click, opens a new CalmClip tab with the source URL as a query parameter.
// The CalmClip web app handles fetching and loading the media locally.

const CALMCLIP_BASE = 'https://calmclip.video'

// During local development, switch to localhost:
// const CALMCLIP_BASE = 'http://localhost:5000'

// ---------------------------------------------------------------------------
// Context menu registration
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  // Appears when right-clicking an HTML5 <video> or <audio> element
  chrome.contextMenus.create({
    id:       'calmclip-edit-media',
    title:    'Edit with CalmClip',
    contexts: ['video', 'audio'],
  })

  // Appears when right-clicking a direct link to a media file
  chrome.contextMenus.create({
    id:       'calmclip-edit-link',
    title:    'Edit with CalmClip',
    contexts: ['link'],
    targetUrlPatterns: [
      '*://*/*.mp4',  '*://*/*.mp4?*',
      '*://*/*.webm', '*://*/*.webm?*',
      '*://*/*.mov',  '*://*/*.mov?*',
      '*://*/*.mkv',  '*://*/*.mkv?*',
      '*://*/*.avi',  '*://*/*.avi?*',
      '*://*/*.m4v',  '*://*/*.m4v?*',
      '*://*/*.mp3',  '*://*/*.mp3?*',
      '*://*/*.wav',  '*://*/*.wav?*',
      '*://*/*.m4a',  '*://*/*.m4a?*',
      '*://*/*.ogg',  '*://*/*.ogg?*',
      '*://*/*.flac', '*://*/*.flac?*',
      '*://*/*.aac',  '*://*/*.aac?*',
    ],
  })
})

// ---------------------------------------------------------------------------
// Click handler (v0 Direct Links)
// ---------------------------------------------------------------------------

chrome.contextMenus.onClicked.addListener((info) => {
  const mediaUrl = info.srcUrl || info.linkUrl
  if (!mediaUrl) return

  // blob: and data: URLs cannot be safely passed via URL params.
  if (mediaUrl.startsWith('blob:') || mediaUrl.startsWith('data:')) {
    chrome.tabs.create({
      url: `${CALMCLIP_BASE}/?source=extension&error=${encodeURIComponent(
        'This video uses a protected stream or inline data that cannot be accessed externally. ' +
        'Try downloading the video first, then drop it into CalmClip.'
      )}`,
    })
    return
  }

  const encoded = encodeURIComponent(mediaUrl)
  chrome.tabs.create({
    url: `${CALMCLIP_BASE}/?source=extension&video=${encoded}`,
  })
})

// ---------------------------------------------------------------------------
// Phase 2: Chunked Streaming (Google Drive)
// ---------------------------------------------------------------------------

// Store pending streams by tabId so we know what to fetch when the tab connects
const pendingStreams = new Map()

// If a tab is closed before it connects, remove its pending stream entry
// so the Map does not grow unboundedly across many Drive/Dropbox/capture jobs.
chrome.tabs.onRemoved.addListener((tabId) => {
  pendingStreams.delete(tabId)
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'fetch_drive' && msg.fileId) {
    chrome.tabs.create({
      url: `${CALMCLIP_BASE}/?source=extension_stream`
    }, (tab) => {
      pendingStreams.set(tab.id, {
        type:        'drive',
        fileId:      msg.fileId,
        sourceTabId: sender.tab?.id,
      })
    })
  } else if (msg.action === 'fetch_dropbox' && msg.url) {
    chrome.tabs.create({
      url: `${CALMCLIP_BASE}/?source=extension_stream`
    }, (tab) => {
      pendingStreams.set(tab.id, {
        type:        'dropbox',
        url:         msg.url,
        sourceTabId: sender.tab?.id,
      })
    })
  } else if (msg.action === 'get_capture_state') {
    sendResponse({ isRecording })
  } else if (msg.action === 'start_tab_capture') {
    handleStartCapture(msg.streamId, sendResponse)
    return true
  } else if (msg.action === 'stop_tab_capture') {
    handleStopCapture()
  }
})

let isRecording = false

async function handleStartCapture(streamId, sendResponse) {
  if (isRecording) {
    if (sendResponse) sendResponse({ error: 'Already recording.' })
    return
  }
  try {
    if (!streamId) throw new Error('No stream ID provided')
    
    await setupOffscreenDocument('offscreen.html')
    
    chrome.runtime.sendMessage({ action: 'start_recording', streamId }, (res) => {
      if (res && res.success) {
        isRecording = true
        if (sendResponse) sendResponse({ success: true })
      } else {
        if (sendResponse) sendResponse({ error: res?.error || 'Recording failed to start.' })
      }
    })
  } catch (err) {
    console.error('Failed to start capture:', err)
    if (sendResponse) sendResponse({ error: err.message })
  }
}

function handleStopCapture() {
  if (!isRecording) return
  // The offscreen document's stop_recording handler now waits for
  // MediaRecorder.onstop before calling sendResponse, so by the time
  // this callback fires, all recorded chunks are guaranteed to be
  // available for relay.
  chrome.runtime.sendMessage({ action: 'stop_recording' }, () => {
    isRecording = false
    chrome.tabs.create({ url: `${CALMCLIP_BASE}/?source=extension_stream` }, (tab) => {
      pendingStreams.set(tab.id, { type: 'tab_capture' })
    })
  })
}

async function setupOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path)
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  })

  if (existingContexts.length > 0) return

  await chrome.offscreen.createDocument({
    url: path,
    reasons: ['USER_MEDIA'],
    justification: 'Recording the active tab'
  })
}

// Wraps a port so that every error message and the final end message also
// trigger a chrome.tabs.sendMessage back to the originating Drive/Dropbox tab.
// This lets the injected button show inline feedback instead of silently
// waiting for a timeout.
function makeNotifyingPort(port, sourceTabId) {
  return {
    postMessage(msg, ...args) {
      if (sourceTabId) {
        if (msg.error) {
          chrome.tabs.sendMessage(sourceTabId, { type: 'calmclip_stream_error', error: msg.error }).catch(() => {})
        } else if (msg.type === 'end') {
          chrome.tabs.sendMessage(sourceTabId, { type: 'calmclip_stream_done' }).catch(() => {})
        }
      }
      port.postMessage(msg, ...args)
    },
    disconnect() { port.disconnect() },
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'calmclip_stream') return

  const tabId = port.sender?.tab?.id
  if (!tabId || !pendingStreams.has(tabId)) {
    port.postMessage({ error: 'No pending stream found for this tab.' })
    port.disconnect()
    return
  }

  const job = pendingStreams.get(tabId)
  pendingStreams.delete(tabId)

  if (job.type === 'drive') {
    streamDriveFile(job.fileId, makeNotifyingPort(port, job.sourceTabId))
  } else if (job.type === 'dropbox') {
    streamDropboxFile(job.url, makeNotifyingPort(port, job.sourceTabId))
  } else if (job.type === 'tab_capture') {
    streamTabCapture(port)
  }
})

function streamTabCapture(port) {
  const offscreenPort = chrome.runtime.connect({ name: 'offscreen_relay' })
  
  offscreenPort.onMessage.addListener((msg) => {
    port.postMessage(msg)
    
    if (msg.type === 'end' || msg.error) {
      offscreenPort.disconnect()
      port.disconnect()
      chrome.offscreen.closeDocument().catch(() => {})
    }
  })

  // If the CalmClip tab closes before streaming finishes, clean up the
  // offscreen document so the recording indicator clears and no orphaned
  // offscreen process is left running.
  port.onDisconnect.addListener(() => {
    offscreenPort.disconnect()
    chrome.offscreen.closeDocument().catch(() => {})
  })
}

async function streamDriveFile(fileId, port) {
  try {
    // Try the modern usercontent endpoint first (avoids the virus-scan bounce
    // more reliably on large files). Fall back to the legacy /uc endpoint if
    // the first request fails outright (non-2xx or network error).
    let downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`
    let res = await fetch(downloadUrl).catch(() => null)
    if (!res || !res.ok) {
      downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`
      res = await fetch(downloadUrl)
    }

    if (!res.ok) {
      port.postMessage({ error: `Failed to fetch from Drive: HTTP ${res.status}` })
      port.disconnect()
      return
    }

    // Google Drive may return an HTML warning page for the virus-scan bypass
    // or a login wall. Follow confirmation bounces up to twice before giving up.
    let bounces = 0
    while ((res.headers.get('content-type') || '').includes('text/html') && bounces < 2) {
      bounces++
      const html = await res.text()

      // Modern Drive embeds the token as confirm=<value> somewhere in the page.
      // It can be a short alphanum token or the literal "t" for trusted clients.
      // Some responses also carry a uuid that must be forwarded.
      const tokenMatch = html.match(/[?&;]confirm=([a-zA-Z0-9_-]+)/) || html.match(/confirm=([a-zA-Z0-9_-]+)/)
      if (!tokenMatch) {
        port.postMessage({ error: 'Google Drive returned an HTML page. Make sure you are signed in and have access to the file.' })
        port.disconnect()
        return
      }

      const nextUrl = new URL(res.url || downloadUrl)
      nextUrl.searchParams.set('confirm', tokenMatch[1])
      const uuidMatch = html.match(/[?&;]uuid=([a-zA-Z0-9_-]+)/) || html.match(/uuid=([a-zA-Z0-9_-]+)/)
      if (uuidMatch) nextUrl.searchParams.set('uuid', uuidMatch[1])
      downloadUrl = nextUrl.toString()

      res = await fetch(downloadUrl)
      if (!res.ok) {
        port.postMessage({ error: `Drive confirmation fetch failed: HTTP ${res.status}` })
        port.disconnect()
        return
      }
    }

    const type = res.headers.get('content-type') || 'video/mp4'

    // If still HTML after all bounces the file is behind a login wall or is restricted.
    if (type.includes('text/html')) {
      port.postMessage({ error: 'Google Drive requires sign-in or special permissions for this file. Download it manually, then drop it into CalmClip.' })
      port.disconnect()
      return
    }

    // Reject non-media responses so the app never receives a stray document.
    const isMedia = type.startsWith('video/') || type.startsWith('audio/') || type === 'application/octet-stream'
    if (!isMedia) {
      port.postMessage({ error: `Drive returned an unexpected file type (${type}). Only video and audio files are supported.` })
      port.disconnect()
      return
    }

    // Prefer the real filename from Content-Disposition over the generic fallback.
    let fileName = `drive-${fileId}.mp4`
    const cd = res.headers.get('content-disposition') || ''
    const fnMatch = cd.match(/filename\*=UTF-8''([^;\r\n]+)/i) || cd.match(/filename=["']?([^"';\r\n]+)["']?/i)
    if (fnMatch) fileName = decodeURIComponent(fnMatch[1].trim())

    port.postMessage({ type: 'start', mimeType: type, name: fileName })

    const reader = res.body.getReader()
    
    // We send in 1MB chunks to stay well under message size limits
    const CHUNK_SIZE = 1024 * 1024
    let buffer = new Uint8Array(0)

    while (true) {
      const { done, value } = await reader.read()

      if (value) {
        // Append to buffer
        const newBuffer = new Uint8Array(buffer.length + value.length)
        newBuffer.set(buffer)
        newBuffer.set(value, buffer.length)
        buffer = newBuffer

        // Send chunks if we exceed CHUNK_SIZE
        while (buffer.length >= CHUNK_SIZE) {
          const chunk = buffer.slice(0, CHUNK_SIZE)
          buffer = buffer.slice(CHUNK_SIZE)
          port.postMessage({ type: 'chunk', data: chunk.buffer }, [chunk.buffer])
        }
      }

      if (done) {
        if (buffer.length > 0) {
          port.postMessage({ type: 'chunk', data: buffer.buffer }, [buffer.buffer])
        }
        port.postMessage({ type: 'end' })
        port.disconnect()
        break
      }
    }
  } catch (err) {
    port.postMessage({ error: err.message })
    port.disconnect()
  }
}

async function streamDropboxFile(url, port) {
  try {
    // Dropbox requires ?dl=1 to force direct download
    let downloadUrl = new URL(url)
    downloadUrl.searchParams.set('dl', '1')
    
    // fetch with credentials just in case it's a private link
    const res = await fetch(downloadUrl.toString(), { credentials: 'omit' })
    
    if (!res.ok) {
      port.postMessage({ error: `Failed to fetch from Dropbox: HTTP ${res.status}` })
      port.disconnect()
      return
    }

    const type = res.headers.get('content-type') || 'video/mp4'

    if (type.includes('text/html')) {
      port.postMessage({ error: 'Dropbox returned an HTML page. Make sure you are signed in and the link is publicly shared.' })
      port.disconnect()
      return
    }

    const isMedia = type.startsWith('video/') || type.startsWith('audio/') || type === 'application/octet-stream'
    if (!isMedia) {
      port.postMessage({ error: `Dropbox returned an unexpected file type (${type}). Only video and audio files are supported.` })
      port.disconnect()
      return
    }

    const nameMatch = downloadUrl.pathname.split('/').pop()
    const fileName = nameMatch ? nameMatch : 'dropbox-video.mp4'
    
    port.postMessage({ type: 'start', mimeType: type, name: fileName })

    const reader = res.body.getReader()
    const CHUNK_SIZE = 1024 * 1024
    let buffer = new Uint8Array(0)

    while (true) {
      const { done, value } = await reader.read()

      if (value) {
        const newBuffer = new Uint8Array(buffer.length + value.length)
        newBuffer.set(buffer)
        newBuffer.set(value, buffer.length)
        buffer = newBuffer

        while (buffer.length >= CHUNK_SIZE) {
          const chunk = buffer.slice(0, CHUNK_SIZE)
          buffer = buffer.slice(CHUNK_SIZE)
          port.postMessage({ type: 'chunk', data: chunk.buffer }, [chunk.buffer])
        }
      }

      if (done) {
        if (buffer.length > 0) {
          port.postMessage({ type: 'chunk', data: buffer.buffer }, [buffer.buffer])
        }
        port.postMessage({ type: 'end' })
        port.disconnect()
        break
      }
    }
  } catch (err) {
    port.postMessage({ error: err.message })
    port.disconnect()
  }
}
