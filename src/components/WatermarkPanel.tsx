import { useRef, useState, useEffect } from 'react'
import { Upload, X } from 'lucide-react'

export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'

export interface WatermarkConfig {
  file:     File
  position: WatermarkPosition
  opacity:  number
  scale:    number
  margin:   number
}

interface Props {
  config:     WatermarkConfig | null
  onChange:   (cfg: WatermarkConfig | null) => void
  onProGate?: () => void
}

const POS_LABELS: Record<WatermarkPosition, string> = {
  'top-left':     'Top left',
  'top-right':    'Top right',
  'bottom-left':  'Bottom left',
  'bottom-right': 'Bottom right',
  'center':       'Center',
}

export default function WatermarkPanel({ config, onChange, onProGate }: Props) {
  const inputRef    = useRef<HTMLInputElement>(null)
  const [preview,   setPreview]   = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const previewRef  = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    }
  }, [])

  useEffect(() => {
    if (!config && previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
      previewRef.current = null
      setPreview(null)
    }
  }, [config])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const ALLOWED_TYPES = ['image/png', 'image/webp', 'image/jpeg', 'image/jpg']
    if (!ALLOWED_TYPES.includes(f.type)) {
      setFileError(`"${f.name}" is not supported. Use PNG, WebP, or JPEG. SVG cannot be decoded by the video encoder.`)
      e.target.value = ''
      return
    }
    setFileError(null)
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    const url = URL.createObjectURL(f)
    previewRef.current = url
    setPreview(url)
    onChange({
      file:     f,
      position: config?.position ?? 'bottom-right',
      opacity:  config?.opacity  ?? 0.8,
      scale:    config?.scale    ?? 15,
      margin:   config?.margin   ?? 10,
    })
    e.target.value = ''
  }

  function remove() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
    setPreview(null)
    onChange(null)
  }

  if (!config) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Upload a PNG, WebP, or JPEG logo to overlay on your export.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/webp,image/jpeg"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <button
          onClick={() => { if (onProGate) { onProGate(); return } inputRef.current?.click() }}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-xs font-medium"
          style={{
            background: 'var(--bg-surface)',
            border:     '1.5px dashed var(--border)',
            color:      'var(--text-muted)',
            cursor:     'pointer',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--primary)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
          }}
        >
          <Upload size={13} />
          Upload logo (PNG, WebP, JPEG)
          {onProGate && <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', background: 'var(--primary-a10)', color: 'var(--primary)', borderRadius: 3, padding: '1px 5px' }}>PRO</span>}
        </button>
        {fileError && (
          <p className="text-xs" style={{ color: '#ef4444' }}>{fileError}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {preview && (
          <div
            className="rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              width: 48, height: 48,
              background: '#1a1a22',
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}
          >
            <img
              src={preview}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              alt="watermark preview"
            />
          </div>
        )}
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {config.file.name}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            Will be burned into the export
          </span>
        </div>
        <button
          onClick={remove}
          style={{
            background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-dim)', padding: 4,
          }}
          title="Remove watermark"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Position</p>
        <div
          className="grid rounded-lg overflow-hidden"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: 'auto auto auto',
            gap: 4,
          }}
        >
          {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as WatermarkPosition[]).map(pos => (
            <button
              key={pos}
              onClick={() => onChange({ ...config, position: pos })}
              className="py-1.5 rounded text-xs"
              style={{
                background: config.position === pos ? 'var(--primary-a15)' : 'var(--bg-surface)',
                border:     `1px solid ${config.position === pos ? 'var(--primary)' : 'var(--border)'}`,
                color:      config.position === pos ? 'var(--primary)' : 'var(--text-muted)',
                cursor:     'pointer',
              }}
            >
              {POS_LABELS[pos]}
            </button>
          ))}
          <button
            onClick={() => onChange({ ...config, position: 'center' })}
            className="py-1.5 rounded text-xs"
            style={{
              gridColumn: '1 / -1',
              background: config.position === 'center' ? 'var(--primary-a15)' : 'var(--bg-surface)',
              border:     `1px solid ${config.position === 'center' ? 'var(--primary)' : 'var(--border)'}`,
              color:      config.position === 'center' ? 'var(--primary)' : 'var(--text-muted)',
              cursor:     'pointer',
            }}
          >
            Center
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Opacity</p>
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {Math.round(config.opacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          value={Math.round(config.opacity * 100)}
          onChange={e => onChange({ ...config, opacity: Number(e.target.value) / 100 })}
          className="w-full"
          style={{ accentColor: 'var(--primary)' }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Size (% of video width)</p>
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {config.scale}%
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={40}
          value={config.scale}
          onChange={e => onChange({ ...config, scale: Number(e.target.value) })}
          className="w-full"
          style={{ accentColor: 'var(--primary)' }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Edge margin (px)</p>
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {config.margin ?? 10}px
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={60}
          step={2}
          value={config.margin ?? 10}
          onChange={e => onChange({ ...config, margin: Number(e.target.value) })}
          className="w-full"
          style={{ accentColor: 'var(--primary)' }}
        />
      </div>
    </div>
  )
}
