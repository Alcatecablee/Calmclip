import { useState, useEffect } from 'react'
import { Monitor, Square, AlertCircle } from 'lucide-react'
import { startScreenRecording, isScreenRecordSupported } from '../lib/screenRecord'
import { loadFfmpeg } from '../lib/ffmpeg'

interface Props {
  onFile:         (file: File) => void
  autoStart?:     boolean
  onAutoStarted?: () => void
}

export default function ScreenRecordButton({ onFile, autoStart, onAutoStarted }: Props) {
  const [recording, setRecording] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  if (!isScreenRecordSupported()) return null

  async function handleClick() {
    setError(null)
    setRecording(true)
    loadFfmpeg().catch(() => {})
    try {
      const { file } = await startScreenRecording()
      onFile(file)
    } catch (e) {
      if (!(e instanceof Error && e.name === 'NotAllowedError')) {
        setError(e instanceof Error ? e.message : 'Screen recording failed.')
      }
    } finally {
      setRecording(false)
    }
  }

  useEffect(() => {
    if (autoStart && !recording) {
      handleClick()
      onAutoStarted?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <div style={{ height: 1, width: 56, background: 'var(--border-subtle)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.05em', fontWeight: 500 }}>or</span>
        <div style={{ height: 1, width: 56, background: 'var(--border-subtle)' }} />
      </div>

      <button
        onClick={handleClick}
        disabled={recording}
        className={`screen-record-btn${recording ? ' is-recording' : ''}`}
      >
        {recording
          ? <><Square size={12} fill="#ef4444" color="#ef4444" /> Recording. Click Stop Share to finish.</>
          : <><Monitor size={12} /> Record your screen instead</>
        }
      </button>

      {error && (
        <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#ef4444' }}>
          <AlertCircle size={11} />
          {error}
        </div>
      )}
    </div>
  )
}
