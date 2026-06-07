// CalmClip - Dropbox Content Injector

console.log('[CalmClip] Dropbox injector loaded')

const DROPBOX_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>'
const DROPBOX_ORIGINAL_HTML = DROPBOX_ICON + '<span>Export to CalmClip</span>'

let dropboxJobTimer = null

function resetDropboxBtn() {
  if (dropboxJobTimer !== null) { clearTimeout(dropboxJobTimer); dropboxJobTimer = null }
  const btn = document.getElementById('calmclip-dropbox-btn')
  if (!btn) return
  btn.innerHTML = DROPBOX_ORIGINAL_HTML
  btn.style.opacity = '1'
  btn.style.pointerEvents = 'auto'
  btn.style.color = '#f2f2f2'
  btn.style.borderColor = 'rgba(255,255,255,0.08)'
  btn.removeAttribute('title')
}

chrome.runtime.onMessage.addListener((msg) => {
  const btn = document.getElementById('calmclip-dropbox-btn')
  if (!btn) return
  if (msg.type === 'calmclip_stream_error') {
    if (dropboxJobTimer !== null) { clearTimeout(dropboxJobTimer); dropboxJobTimer = null }
    btn.innerHTML = DROPBOX_ICON + '<span>Export failed</span>'
    btn.title = msg.error
    btn.style.opacity = '1'
    btn.style.pointerEvents = 'auto'
    btn.style.color = '#ef4444'
    btn.style.borderColor = '#ef4444'
    dropboxJobTimer = setTimeout(resetDropboxBtn, 8000)
  } else if (msg.type === 'calmclip_stream_done') {
    resetDropboxBtn()
  }
})

function injectButton() {
  if (document.getElementById('calmclip-dropbox-btn')) return

  // Dropbox UI is also SPA-heavy
  const btn = document.createElement('button')
  btn.id = 'calmclip-dropbox-btn'
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

  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"></polygon>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
    </svg>
    <span>Export to CalmClip</span>
  `

  btn.addEventListener('mouseover', () => btn.style.backgroundColor = '#202022')
  btn.addEventListener('mouseout', () => btn.style.backgroundColor = '#111113')

  btn.addEventListener('click', () => {
    if (dropboxJobTimer !== null) { clearTimeout(dropboxJobTimer); dropboxJobTimer = null }
    btn.textContent = 'Exporting...'
    btn.style.opacity = '0.7'
    btn.style.pointerEvents = 'none'
    btn.style.color = '#f2f2f2'
    btn.style.borderColor = 'rgba(255,255,255,0.08)'
    btn.removeAttribute('title')

    chrome.runtime.sendMessage({
      action: 'fetch_dropbox',
      url: location.href
    })

    // Fallback: reset 65 s after click if no success or error arrives.
    dropboxJobTimer = setTimeout(resetDropboxBtn, 65_000)
  })

  document.body.appendChild(btn)
}

const observer = new MutationObserver(() => {
  // Check if it's a file view URL 
  if (location.pathname.includes('/s/') || location.pathname.includes('/scl/fi/')) {
    injectButton()
  } else {
    const btn = document.getElementById('calmclip-dropbox-btn')
    if (btn) btn.remove()
  }
})

observer.observe(document.body, { childList: true, subtree: true })
injectButton()
