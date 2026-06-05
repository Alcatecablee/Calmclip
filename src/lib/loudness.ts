export type LoudnessTarget = 'youtube' | 'podcast' | 'broadcast' | 'off'

export interface LoudnessPreset {
  key:    LoudnessTarget
  label:  string
  lufs:   number
  desc:   string
}

export const LOUDNESS_PRESETS: LoudnessPreset[] = [
  { key: 'youtube',   label: 'YouTube',   lufs: -14, desc: '-14 LUFS' },
  { key: 'podcast',   label: 'Podcast',   lufs: -16, desc: '-16 LUFS' },
  { key: 'broadcast', label: 'Broadcast', lufs: -23, desc: '-23 LUFS' },
]

export function loudnormFilter(target: LoudnessTarget): string | null {
  const preset = LOUDNESS_PRESETS.find(p => p.key === target)
  if (!preset) return null
  // linear=true eliminates the internal two-pass buffering that the default
  // non-linear mode uses. Without it, FFmpeg buffers the entire audio stream
  // before outputting a single sample, freezing the progress bar and running
  // at roughly 10x wall-clock time in single-threaded WASM. linear=true
  // measures integrated loudness in one streaming pass and applies a constant
  // gain, which is accurate enough for all practical speech and music content.
  return `loudnorm=I=${preset.lufs}:TP=-1:LRA=11:linear=true`
}
