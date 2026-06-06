import { useState } from 'react'
import { Save, Trash2, ChevronDown, ChevronUp, Pencil, Check, X } from 'lucide-react'
import type { CropMode } from '../lib/ffmpeg'
import type { WatermarkConfig, WatermarkPosition } from './WatermarkPanel'

type Ratio = '16:9' | '9:16' | '1:1' | '4:5' | 'Original'

export interface ExportPreset {
  id:                 string
  name:               string
  ratio:              Ratio
  cropMode:           CropMode
  stripMeta:          boolean
  createdAt:          number
  watermarkPosition?: WatermarkPosition
  watermarkOpacity?:  number
  watermarkScale?:    number
}

const STORAGE_KEY = 'calmclip_export_presets_v2'

const VALID_RATIOS    = new Set(['16:9', '9:16', '1:1', '4:5', 'Original'])
const VALID_CROPMODES = new Set(['fit', 'fill'])

function isValidPreset(p: unknown): p is ExportPreset {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  return (
    typeof o.id        === 'string' &&
    typeof o.name      === 'string' &&
    typeof o.createdAt === 'number' &&
    typeof o.stripMeta === 'boolean' &&
    VALID_RATIOS.has(o.ratio       as string) &&
    VALID_CROPMODES.has(o.cropMode as string)
  )
}

export function loadPresets(): ExportPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidPreset)
  } catch {
    return []
  }
}

export function savePresetsToStorage(presets: ExportPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

interface Props {
  ratio:      Ratio
  cropMode:   CropMode
  stripMeta:  boolean
  watermark:  WatermarkConfig | null
  onApply:    (preset: ExportPreset) => void
  onProGate?: () => void
}

export default function ExportPresets({
  ratio, cropMode, stripMeta, watermark, onApply, onProGate,
}: Props) {
  const [presets,     setPresets]     = useState<ExportPreset[]>(loadPresets)
  const [nameInput,   setNameInput]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [expanded,    setExpanded]    = useState(false)
  const [savedFlash,  setSavedFlash]  = useState(false)
  const [saveError,   setSaveError]   = useState<string | null>(null)
  const [renamingId,  setRenamingId]  = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  function persistPresets(updated: ExportPreset[]): boolean {
    try {
      savePresetsToStorage(updated)
      setSaveError(null)
      return true
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save presets. Storage may be full.')
      return false
    }
  }

  function handleSave() {
    const name = nameInput.trim()
    if (!name) return
    if (presets.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      setSaveError(`A preset named "${name}" already exists.`)
      return
    }
    const preset: ExportPreset = {
      id:                crypto.randomUUID(),
      name,
      ratio,
      cropMode,
      stripMeta,
      createdAt:         Date.now(),
      watermarkPosition: watermark?.position,
      watermarkOpacity:  watermark?.opacity,
      watermarkScale:    watermark?.scale,
    }
    const willDrop = presets.length >= 10
    const updated  = [preset, ...presets].slice(0, 10)
    setPresets(updated)
    if (!persistPresets(updated)) return
    setNameInput('')
    setSaving(false)
    setSavedFlash(true)
    if (willDrop) setSaveError('Oldest preset removed to stay within the 10-preset limit.')
    setTimeout(() => setSavedFlash(false), 1800)
  }

  function handleDelete(id: string) {
    const updated = presets.filter(p => p.id !== id)
    setPresets(updated)
    persistPresets(updated)
  }

  function startRename(p: ExportPreset) {
    setRenamingId(p.id)
    setRenameValue(p.name)
    setSaveError(null)
  }

  function commitRename(id: string) {
    const name = renameValue.trim()
    if (!name) { setSaveError('Preset name cannot be empty.'); return }
    const conflict = presets.find(p => p.id !== id && p.name.toLowerCase() === name.toLowerCase())
    if (conflict) { setSaveError(`A preset named "${name}" already exists.`); return }
    const updated = presets.map(p => p.id === id ? { ...p, name } : p)
    setPresets(updated)
    persistPresets(updated)
    setRenamingId(null)
    setRenameValue('')
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
    setSaveError(null)
  }

  function describePreset(p: ExportPreset): string {
    const parts: string[] = [p.ratio, p.cropMode === 'fill' ? 'crop' : 'fit']
    if (!p.stripMeta) parts.push('keep meta')
    if (p.watermarkPosition) parts.push(`mark: ${p.watermarkPosition}`)
    return parts.join(', ')
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          {presets.length === 0
            ? 'Save current settings as a named preset.'
            : `${presets.length} saved preset${presets.length !== 1 ? 's' : ''}.`}
        </p>
        <button
          onClick={() => { if (onProGate) { onProGate(); return } setSaving(s => !s); setSaveError(null) }}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
          style={{
            background: saving ? 'var(--primary-a10)' : 'var(--bg-surface)',
            border:     `1px solid ${saving ? 'var(--primary)' : 'var(--border)'}`,
            color:      saving ? 'var(--primary)' : 'var(--text-muted)',
            cursor:     'pointer',
          }}
        >
          <Save size={11} />
          Save current
          {onProGate && <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', background: 'var(--primary-a10)', color: 'var(--primary)', borderRadius: 3, padding: '1px 5px' }}>PRO</span>}
        </button>
      </div>

      {saving && (
        <div className="flex flex-col gap-1.5">
          {presets.length >= 10 && (
            <p className="text-xs" style={{ color: '#f59e0b' }}>
              At the 10-preset limit. Saving will remove the oldest preset ({presets[presets.length - 1].name}).
            </p>
          )}
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={e => { setNameInput(e.target.value); setSaveError(null) }}
              onKeyDown={e => {
                if (e.key === 'Enter')  handleSave()
                if (e.key === 'Escape') { setSaving(false); setSaveError(null) }
              }}
              placeholder="Preset name (e.g. YouTube 1080p)"
              maxLength={40}
              className="flex-1 text-xs rounded-lg px-3 py-2 outline-none"
              style={{
                background:  'var(--bg-surface)',
                border:      '1.5px solid var(--primary)',
                color:       'var(--text-primary)',
                caretColor:  'var(--primary)',
              }}
            />
            <button
              onClick={handleSave}
              disabled={!nameInput.trim()}
              className="text-xs px-3 py-2 rounded-lg"
              style={{
                background: nameInput.trim() ? 'var(--primary-a10)' : 'var(--bg-surface)',
                border:     `1px solid ${nameInput.trim() ? 'var(--primary)' : 'var(--border)'}`,
                color:      nameInput.trim() ? 'var(--primary)' : 'var(--text-faint)',
                cursor:     nameInput.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {savedFlash && (
        <p className="text-xs" style={{ color: '#10b981' }}>Preset saved.</p>
      )}

      {saveError && (
        <p className="text-xs" style={{ color: '#ef4444' }}>{saveError}</p>
      )}

      {presets.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center justify-between w-full text-xs"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 0 }}
          >
            <span>Saved presets</span>
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>

          {expanded && (
            <div className="flex flex-col gap-1">
              {presets.map(p => (
                <div
                  key={p.id}
                  className="flex flex-col gap-1.5 px-3 py-2 rounded-lg"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  {renamingId === p.id ? (
                    <div className="flex gap-1.5">
                      <input
                        autoFocus
                        type="text"
                        value={renameValue}
                        maxLength={40}
                        onChange={e => { setRenameValue(e.target.value); setSaveError(null) }}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  commitRename(p.id)
                          if (e.key === 'Escape') cancelRename()
                        }}
                        className="flex-1 text-xs rounded px-2 py-1 outline-none"
                        style={{
                          background:  'var(--bg-surface)',
                          border:      '1.5px solid var(--primary)',
                          color:       'var(--text-primary)',
                          caretColor:  'var(--primary)',
                        }}
                      />
                      <button
                        onClick={() => commitRename(p.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', padding: '2px 4px', flexShrink: 0 }}
                        title="Confirm rename"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={cancelRename}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: '2px 4px', flexShrink: 0 }}
                        title="Cancel rename"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-xs font-medium truncate" style={{ color: 'var(--text-muted)' }}>
                          {p.name}
                        </span>
                        <span className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>
                          {describePreset(p)}
                        </span>
                      </div>
                      <button
                        onClick={() => { if (onProGate) { onProGate(); return } onApply(p) }}
                        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded flex-shrink-0"
                        style={{
                          background: 'var(--primary-a10)',
                          border:     '1px solid var(--primary-a20)',
                          color:      'var(--primary)',
                          cursor:     'pointer',
                        }}
                        title="Load this preset's settings"
                      >
                        Apply
                        {onProGate && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', background: 'var(--primary-a10)', color: 'var(--primary)', borderRadius: 3, padding: '1px 5px' }}>PRO</span>}
                      </button>
                      <button
                        onClick={() => startRename(p)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: '2px 4px', flexShrink: 0 }}
                        title="Rename preset"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: '2px 4px', flexShrink: 0 }}
                        title="Delete preset"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div
        className="rounded-lg p-3 text-xs"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <p className="mb-1.5" style={{ color: 'var(--text-faint)' }}>Current settings</p>
        <div className="flex flex-col gap-1">
          {([
            ['Ratio',     ratio],
            ['Crop',      cropMode === 'fill' ? 'Crop to fill' : 'Fit (letter-box)'],
            ['Metadata',  stripMeta ? 'Strip on export' : 'Keep metadata'],
            ['Watermark', watermark ? `${watermark.position}, ${Math.round(watermark.opacity * 100)}% opacity` : 'None'],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span style={{ color: 'var(--text-faint)' }}>{label}</span>
              <span style={{ color: 'var(--text-muted)' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
