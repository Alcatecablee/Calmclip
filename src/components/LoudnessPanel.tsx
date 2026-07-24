import { Volume2, VolumeX } from 'lucide-react'
import { LOUDNESS_PRESETS, type LoudnessTarget } from '../lib/loudness'
import { recordToolUsage } from '../lib/projectSession'

interface Props {
  target:    LoudnessTarget
  onChange:  (t: LoudnessTarget) => void
  denoise:   boolean
  hasAudio?: boolean
}

export default function LoudnessPanel({ target, onChange, denoise, hasAudio = true }: Props) {
  if (!hasAudio) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        No audio track detected in this video. Loudness normalization is not available.
      </p>
    )
  }

  const enabled = target !== 'off'

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => { if (!enabled) recordToolUsage('loudness').catch(() => {}); onChange(enabled ? 'off' : 'youtube') }}
        className="flex items-center gap-2 text-sm w-full transition-colors"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: enabled ? 'var(--primary)' : 'var(--text-muted)' }}
        title="Apply a loudnorm filter at export to reach a target loudness level"
      >
        {enabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
        <span>Normalize loudness</span>
      </button>

      {enabled && (
        <div className="flex gap-2 pl-5">
          {LOUDNESS_PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => onChange(p.key)}
              className="flex flex-col items-center flex-1 py-2 rounded-lg transition-all text-xs"
              style={{
                background: target === p.key ? 'var(--primary-a12)' : 'var(--bg-surface)',
                border:     `1px solid ${target === p.key ? 'var(--primary)' : 'var(--border)'}`,
                color:      target === p.key ? 'var(--primary)' : 'var(--text-muted)',
                cursor:     'pointer',
              }}
              title={`Normalize to ${p.lufs} LUFS (${p.label} standard)`}
            >
              <span className="font-semibold">
                {p.label}
              </span>
              <span>{p.desc}</span>
            </button>
          ))}
        </div>
      )}

      {enabled && (
        <p className="text-xs pl-5" style={{ color: 'var(--text-dim)' }}>
          Applied via ffmpeg loudnorm filter at export. No pre-scan required.
        </p>
      )}

      {denoise && (
        <>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            Spectral noise reduction applied at export. Reduces hiss, fans, and AC hum. No effect on the preview.
          </p>
        </>
      )}
    </div>
  )
}
