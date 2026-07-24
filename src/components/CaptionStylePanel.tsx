import { CAPTION_PRESETS } from '@/lib/captionEngine'
import type { CaptionStyle } from '@/lib/captionEngine'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Palette, Settings2 } from 'lucide-react'

interface Props {
  style: CaptionStyle
  onChange: (s: CaptionStyle) => void
}

export default function CaptionStylePanel({ style, onChange }: Props) {
  const presets = Object.values(CAPTION_PRESETS)

  const update = (key: keyof CaptionStyle, value: unknown) => {
    onChange({ ...style, [key]: value })
  }

  return (
    <div className="space-y-6">
      {/* Preset Grid */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
          <Palette className="w-3.5 h-3.5" />
          Style Presets
        </label>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onChange({ ...preset })}
              className="relative p-3 rounded-lg text-left transition-all duration-200"
              style={{
                border: `1.5px solid ${style.id === preset.id ? 'var(--primary)' : 'var(--border)'}`,
                background: style.id === preset.id ? 'var(--primary-a8)' : 'var(--bg-surface)',
                boxShadow: style.id === preset.id ? '0 0 0 1px var(--primary-a15)' : 'none',
              }}
            >
              <div className="font-semibold text-sm mb-0.5" style={{ color: style.id === preset.id ? 'var(--primary)' : 'var(--text-primary)' }}>{preset.name}</div>
              <div className="text-[10px] leading-tight" style={{ color: 'var(--text-faint)' }}>{preset.description}</div>
              {/* Mini preview */}
              <div className="mt-2 h-6 flex items-center justify-center rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.7)' }}>
                <span
                  style={{
                    fontFamily: preset.fontFamily,
                    fontWeight: preset.fontWeight,
                    fontSize: '10px',
                    color: preset.color,
                    textTransform: preset.textTransform,
                    WebkitTextStroke: `0.5px ${preset.strokeColor}`,
                  }}
                >
                  HELLO{' '}
                  <span style={{ color: preset.highlightColor }}>WORLD</span>
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Fine-tune controls */}
      <div className="space-y-4 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <label className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
          <Settings2 className="w-3.5 h-3.5" />
          Fine Tune
        </label>

        <div className="space-y-3">
          <div>
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Font Size</Label>
            <Slider
              value={[style.fontSize]}
              min={24}
              max={96}
              step={2}
              onValueChange={([v]) => update('fontSize', v)}
              className="mt-1"
            />
            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{style.fontSize}px</span>
          </div>

          <div>
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Words Per Group</Label>
            <Slider
              value={[style.wordsPerGroup]}
              min={1}
              max={8}
              step={1}
              onValueChange={([v]) => update('wordsPerGroup', v)}
              className="mt-1"
            />
            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{style.wordsPerGroup} words</span>
          </div>

          <div>
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Position</Label>
            <Select value={style.position} onValueChange={(v) => update('position', v)}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Animation</Label>
            <Select value={style.animation} onValueChange={(v) => update('animation', v)}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="scale">Scale Pop</SelectItem>
                <SelectItem value="bounce">Bounce</SelectItem>
                <SelectItem value="fade">Fade</SelectItem>
                <SelectItem value="glow">Neon Glow</SelectItem>
                <SelectItem value="shake">Shake</SelectItem>
                <SelectItem value="punch">Punch</SelectItem>
                <SelectItem value="glitch">Glitch RGB</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Text Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={style.color.startsWith('rgba') ? '#ffffff' : style.color}
                  onChange={(e) => update('color', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent"
                  style={{ border: '1.5px solid var(--border)', padding: 1 }}
                />
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{style.color}</span>
              </div>
            </div>
            <div>
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Highlight Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={style.highlightColor}
                  onChange={(e) => update('highlightColor', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent"
                  style={{ border: '1.5px solid var(--border)', padding: 1 }}
                />
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{style.highlightColor}</span>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Stroke Width</Label>
            <Slider
              value={[style.strokeWidth]}
              min={0}
              max={12}
              step={1}
              onValueChange={([v]) => update('strokeWidth', v)}
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Background Box</Label>
            <Switch
              checked={style.bgEnabled}
              onCheckedChange={(v) => update('bgEnabled', v)}
            />
          </div>

          {style.bgEnabled && (
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Per-word Boxes</Label>
                <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>Box each word individually</p>
              </div>
              <Switch
                checked={style.bgPerWord ?? false}
                onCheckedChange={(v) => update('bgPerWord', v)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
