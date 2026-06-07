// CalmClip - Offscreen MediaRecorder

let mediaRecorder = null
let recordedChunks = []
let mimeType = 'video/webm'

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'start_recording') {
    startRecording(msg.streamId).then(sendResponse)
    return true
  } 
  if (msg.action === 'stop_recording') {
    stopRecording().then(() => {
      sendResponse({ success: true })
    })
    return true // keep channel open for async sendResponse
  }
})

// Listen for the SW asking us to stream the recorded blob back
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'offscreen_relay') {
    streamBlobToPort(port)
  }
})

async function startRecording(streamId) {
  let stream = null
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    })

    // Try high quality webm
    const options = { mimeType: 'video/webm; codecs=vp9' }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm'
    }
    mimeType = options.mimeType

    mediaRecorder = new MediaRecorder(stream, options)
    recordedChunks = []

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data)
      }
    }

    mediaRecorder.start(1000) // Emit chunks every second
    return { success: true }

  } catch (err) {
    // If we acquired the stream but MediaRecorder construction failed,
    // stop the tracks so the camera/mic indicator clears.
    if (stream) stream.getTracks().forEach(t => t.stop())
    console.error('Failed to start recording:', err)
    return { error: err.message }
  }
}

function stopRecording() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve()
      return
    }

    mediaRecorder.onstop = () => {
      mediaRecorder.stream.getTracks().forEach(t => t.stop())
      resolve()
    }

    mediaRecorder.stop()
  })
}

async function streamBlobToPort(port) {
  if (recordedChunks.length === 0) {
    port.postMessage({ error: 'No recorded data.' })
    port.disconnect()
    return
  }

  const blob = new Blob(recordedChunks, { type: mimeType })
  port.postMessage({ type: 'start', mimeType: mimeType, name: 'tab-recording.webm' })

  // We read the Blob as an ArrayBuffer and send in 1MB chunks
  const arrayBuffer = await blob.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuffer)
  
  const CHUNK_SIZE = 1024 * 1024
  let offset = 0

  while (offset < uint8.length) {
    const chunk = uint8.slice(offset, offset + CHUNK_SIZE)
    port.postMessage({ type: 'chunk', data: chunk.buffer }, [chunk.buffer])
    offset += CHUNK_SIZE
  }

  port.postMessage({ type: 'end' })
  port.disconnect()
  
  // Clear memory
  recordedChunks = []
}
