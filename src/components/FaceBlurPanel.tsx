import { useState, useRef } from 'react'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { recordToolUsage } from '../lib/projectSession'

export interface BlurRegion {
  id:   number
  x:    number
  y:    number
  w:    number
  h:    number
  note: string
}

interface Props {
  regions:   BlurRegion[]
  onChange:  (regions: BlurRegion[]) => void
  isDrawing?: boolean
  onStartDrawing?: () => void
}

let nextId = 1

export default function FaceBlurPanel({ regions, onChange, isDrawing, onStartDrawing }: Props) {
  const [adding,          setAdding]          = useState(false)
  const [label,           setLabel]           = useState('')
  const [xPct,            setXPct]            = useState('50')
  const [yPct,            setYPct]            = useState('20')
  const [wPct,            setWPct]            = useState('20')
  const [hPct,            setHPct]            = useState('30')
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputRef                              = useRef<HTMLInputElement>(null)

  const enabled = regions.length > 0

  function addRegion() {
    const x = parseFloat(xPct)
    const y = parseFloat(yPct)
    const w = parseFloat(wPct)
    const h = parseFloat(hPct)
    if ([x, y, w, h].some(n => isNaN(n) || n < 0 || n > 100)) {
      setValidationError('All fields must be numbers between 0 and 100.')
      return
    }
    if (w <= 0 || h <= 0) {
      setValidationError('Width and height must be greater than 0.')
      return
    }
    const cx = Math.min(x, 100)
    const cy = Math.min(y, 100)
    const cw = Math.min(w, 100 - cx)
    const ch = Math.min(h, 100 - cy)
    if (cw <= 0 || ch <= 0) {
      setValidationError('Region falls outside the frame. Reduce X or Y, or increase W or H.')
      return
    }
    setValidationError(null)
    recordToolUsage('faceBlur').catch(() => {})
    onChange([...regions, { id: nextId++, x: cx, y: cy, w: cw, h: ch, note: label || 'Region' }])
    setAdding(false)
    setLabel('')
  }

  function remove(id: number) {
    onChange(regions.filter(r => r.id !== id))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs" style={{ color: enabled ? 'var(--primary)' : 'var(--text-muted)' }}>
        {enabled ? <Eye size={11} /> : <EyeOff size={11} />}
        <span>{enabled ? `${regions.length} blur ${regions.length === 1 ? 'region' : 'regions'} set` : 'No blur regions set'}</span>
      </div>

      {regions.length > 0 && (
        <div className="flex flex-col gap-1">
          {regions.map(r => (
            <div
              key={r.id}
              className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <span style={{ color: 'var(--text-primary)' }}>{r.note}</span>
              <span style={{ color: 'var(--text-muted)' }}>
                x:{r.x}% y:{r.y}% {r.w}x{r.h}%
              </span>
              <button
                onClick={() => remove(r.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                title="Remove this blur region"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div
          className="rounded-lg p-3 flex flex-col gap-2"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Enter region as percent of frame (0-100). Top-left origin.
          </p>
          <input
            ref={inputRef}
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Label (e.g. Face 1)"
            className="rounded-lg px-3 py-2 text-xs outline-none"
            style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <div className="grid grid-cols-2 gap-2">
            {([['X %', xPct, setXPct], ['Y %', yPct, setYPct], ['W %', wPct, setWPct], ['H %', hPct, setHPct]] as [string, string, (v: string) => void][]).map(([lbl, val, set]) => (
              <div key={lbl} className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{lbl}</span>
                <input
                  type="number"
                  min={0} max={100}
                  value={val}
                  onChange={e => set(e.target.value)}
                  className="rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            ))}
          </div>
          {validationError && (
            <p className="text-xs" style={{ color: '#ef4444' }}>{validationError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={addRegion}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--primary-a12)', border: '1px solid var(--primary)', color: 'var(--primary)', cursor: 'pointer' }}
            >
              Add blur region
            </button>
            <button
              onClick={() => { setAdding(false); setValidationError(null) }}
              className="py-1.5 px-3 rounded-lg text-xs"
              style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isDrawing && (
        <div
          className="p-3 text-xs rounded-lg flex flex-col gap-1.5"
          style={{
            borderLeft: '2px solid var(--primary)',
            background: 'var(--primary-a8)',
            color: 'var(--primary)',
          }}
        >
          <span className="font-semibold">Drawing active</span>
          <span>Click and drag directly on the video player to draw your blur region box.</span>
        </div>
      )}

      {!adding && !isDrawing && (
        <button
          onClick={() => {
            if (onStartDrawing) {
              onStartDrawing()
            } else {
              setAdding(true)
              setTimeout(() => inputRef.current?.focus(), 50)
            }
          }}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-colors"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', width: '100%' }}
          title="Draw a box directly on the video player to define a blur region"
        >
          <Plus size={11} />
          Add blur region
        </button>
      )}

      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
        Regions are blurred via ffmpeg at export. Blur applies to the entire clip duration.
      </p>
    </div>
  )
}
