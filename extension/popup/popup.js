document.addEventListener('DOMContentLoaded', async () => {
  const idlePanel = document.getElementById('idle-panel')
  const recordingPanel = document.getElementById('recording-panel')
  const recordBtn = document.getElementById('record-btn')
  const stopBtn = document.getElementById('stop-btn')
  const timerEl = document.getElementById('timer')

  let timerInterval = null
  let startTime = null

  // Check if we're already recording (e.g. popup was closed and reopened)
  try {
    const state = await chrome.runtime.sendMessage({ action: 'get_capture_state' })
    if (state && state.isRecording) {
      // Restore recording UI, we don't know the exact start time,
      // so start the timer from 0 on reopen.
      startTime = Date.now()
      showRecordingState()
    }
  } catch (err) {
    console.warn('Could not get capture state:', err)
  }

  recordBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab) return

    recordBtn.disabled = true
    recordBtn.textContent = 'Starting...'

    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
      if (!streamId || chrome.runtime.lastError) {
        recordBtn.disabled = false
        recordBtn.textContent = 'Record This Tab'
        const statusText = document.getElementById('status-text')
        statusText.textContent = 'Error: ' + (chrome.runtime.lastError?.message || 'Could not get stream ID')
        statusText.style.color = '#e53935'
        return
      }
      startTime = Date.now()
      showRecordingState()
      chrome.runtime.sendMessage({ action: 'start_tab_capture', streamId }, (res) => {
        if (res && res.error) {
          idlePanel.classList.remove('hidden')
          recordingPanel.classList.add('hidden')
          clearInterval(timerInterval)
          recordBtn.disabled = false
          recordBtn.textContent = 'Record This Tab'
          const statusText = document.getElementById('status-text')
          statusText.textContent = 'Error: ' + res.error
          statusText.style.color = '#e53935'
        }
      })
    })
  })

  stopBtn.addEventListener('click', () => {
    stopBtn.textContent = 'Processing...'
    stopBtn.disabled = true
    clearInterval(timerInterval)
    chrome.runtime.sendMessage({ action: 'stop_tab_capture' })
    setTimeout(() => window.close(), 1500)
  })

  function showRecordingState() {
    idlePanel.classList.add('hidden')
    recordingPanel.classList.remove('hidden')

    // Start the live timer
    clearInterval(timerInterval)
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0')
      const secs = String(elapsed % 60).padStart(2, '0')
      timerEl.textContent = `${mins}:${secs}`
    }, 250)
  }
})
