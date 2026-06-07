import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'

// Prevent the browser from restoring the last scroll position on refresh.
// Without this, refreshing while scrolled to the demo section puts you
// back there instead of starting at the top of the landing page.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then(reg => {
        // Check for updates every 60 seconds while the page is open
        setInterval(() => reg.update().catch(() => {}), 60_000)

        // If the page loaded without cross-origin isolation (no active SW yet),
        // wait for the new SW to activate then reload to get COI headers.
        if (!crossOriginIsolated) {
          const sw = reg.installing ?? reg.waiting
          if (sw) {
            sw.addEventListener('statechange', function () {
              if (this.state === 'activated') window.location.reload()
            })
          } else if (reg.active) {
            window.location.reload()
          }
        }
      })
      .catch(err => console.error('[CalmClip] SW registration failed:', err))
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Analytics />
    </ErrorBoundary>
  </StrictMode>,
)
