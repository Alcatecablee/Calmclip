// CalmClip - Google Drive Content Injector

console.log('[CalmClip] Drive injector loaded')

const DRIVE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>'
const DRIVE_ORIGINAL_HTML = DRIVE_ICON + '<span>Export to CalmClip</span>'

let driveJobTimer = null

function resetDriveBtn() {
  if (driveJobTimer !== null) { clearTimeout(driveJobTimer); driveJobTimer = null }
  const btn = document.getElementById('calmclip-drive-btn')
  if (!btn) return
  btn.innerHTML = DRIVE_ORIGINAL_HTML
  btn.style.opacity = '1'
  btn.style.pointerEvents = 'auto'
  btn.style.color = '#f2f2f2'
  btn.style.borderColor = 'rgba(255,255,255,0.08)'
  btn.removeAttribute('title')
}

chrome.runtime.onMessage.addListener((msg) => {
  const btn = document.getElementById('calmclip-drive-btn')
  if (!btn) return
  if (msg.type === 'calmclip_stream_error') {
    if (driveJobTimer !== null) { clearTimeout(driveJobTimer); driveJobTimer = null }
    btn.innerHTML = DRIVE_ICON + '<span>Export failed</span>'
    btn.title = msg.error
    btn.style.opacity = '1'
    btn.style.pointerEvents = 'auto'
    btn.style.color = '#ef4444'
    btn.style.borderColor = '#ef4444'
    driveJobTimer = setTimeout(resetDriveBtn, 8000)
  } else if (msg.type === 'calmclip_stream_done') {
    resetDriveBtn()
  }
})

function extractFileId() {
  const match = location.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

function injectButton() {
  if (document.getElementById('calmclip-drive-btn')) return

  const fileId = extractFileId()
  if (!fileId) return

  // We float the button because Drive's DOM is highly obfuscated and changes often.
  const btn = document.createElement('button')
  btn.id = 'calmclip-drive-btn'
  btn.textContent = 'Edit in CalmClip'
  Object.assign(btn.style, {
    position: 'fixed',
    top: '70px',
    right: '24px',
    zIndex: '9999',
    padding: '8px 16px',
    backgroundColor: '#111113',
    color: '#f2f2f2',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'Inter, system-ui, sans-serif'
  })

  // Add a small camera icon
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"></polygon>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
    </svg>
    <span>Export to CalmClip</span>
  `

  btn.addEventListener('mouseover', () => {
    btn.style.backgroundColor = '#202022'
  })
  btn.addEventListener('mouseout', () => {
    btn.style.backgroundColor = '#111113'
  })

  btn.addEventListener('click', () => {
    if (driveJobTimer !== null) { clearTimeout(driveJobTimer); driveJobTimer = null }
    btn.textContent = 'Exporting...'
    btn.style.opacity = '0.7'
    btn.style.pointerEvents = 'none'
    btn.style.color = '#f2f2f2'
    btn.style.borderColor = 'rgba(255,255,255,0.08)'
    btn.removeAttribute('title')

    chrome.runtime.sendMessage({
      action: 'fetch_drive',
      fileId: fileId
    })

    // Fallback: reset 65 s after click if no success or error arrives.
    // This matches the 60 s stream timeout in the PWA, with 5 s of buffer.
    driveJobTimer = setTimeout(resetDriveBtn, 65_000)
  })

  document.body.appendChild(btn)
}

// Drive is an SPA, so we observe mutations to re-inject if needed
const observer = new MutationObserver(() => {
  // Only inject if we are looking at a file preview
  if (location.pathname.includes('/view')) {
    injectButton()
  } else {
    const btn = document.getElementById('calmclip-drive-btn')
    if (btn) btn.remove()
  }
})

observer.observe(document.body, { childList: true, subtree: true })
injectButton()
