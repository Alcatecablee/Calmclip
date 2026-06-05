import { describe, it, expect } from 'vitest'
import { loudnormFilter, LOUDNESS_PRESETS } from '../loudness'

describe('loudnormFilter', () => {
  it('returns null for "off"', () => {
    expect(loudnormFilter('off')).toBeNull()
  })

  it('returns a string for youtube', () => {
    const result = loudnormFilter('youtube')
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
  })

  it('youtube filter targets -14 LUFS', () => {
    expect(loudnormFilter('youtube')).toContain('I=-14')
  })

  it('podcast filter targets -16 LUFS', () => {
    expect(loudnormFilter('podcast')).toContain('I=-16')
  })

  it('broadcast filter targets -23 LUFS', () => {
    expect(loudnormFilter('broadcast')).toContain('I=-23')
  })

  it('all non-off presets produce a loudnorm= filter string', () => {
    for (const preset of LOUDNESS_PRESETS) {
      const result = loudnormFilter(preset.key)
      expect(result).toMatch(/^loudnorm=/)
    }
  })

  it('filter includes TP and LRA parameters', () => {
    const result = loudnormFilter('youtube')!
    expect(result).toContain('TP=')
    expect(result).toContain('LRA=')
  })
})

describe('LOUDNESS_PRESETS', () => {
  it('has entries for youtube, podcast, and broadcast', () => {
    const keys = LOUDNESS_PRESETS.map(p => p.key)
    expect(keys).toContain('youtube')
    expect(keys).toContain('podcast')
    expect(keys).toContain('broadcast')
  })

  it('LUFS values are negative', () => {
    for (const preset of LOUDNESS_PRESETS) {
      expect(preset.lufs).toBeLessThan(0)
    }
  })

  it('each preset has a non-empty label and desc', () => {
    for (const preset of LOUDNESS_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0)
      expect(preset.desc.length).toBeGreaterThan(0)
    }
  })
})
