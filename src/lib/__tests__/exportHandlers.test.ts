import { describe, it, expect } from 'vitest'
import { formatBytes, formatDate, validateExport } from '../exportHandlers'

describe('formatBytes', () => {
  it('returns "0 B" for zero', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes under 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB')
  })

  it('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
  })
})

describe('validateExport', () => {
  const baseParams = {
    file: { size: 1024 * 1024 * 10 } as unknown as File,
    trimStart: 0,
    trimEnd: 30,
    duration: 60,
    silenceSegs: [],
    removeSilence: false,
    manualCuts: [],
    blurRegions: [],
  }

  it('returns null when all parameters are within limits', () => {
    expect(validateExport(baseParams)).toBeNull()
  })

  it('returns an error when silence cuts exceed 80', () => {
    const silenceSegs = Array.from({ length: 81 }, (_, i) => ({ start: i * 2, end: i * 2 + 0.5 }))
    const result = validateExport({ ...baseParams, silenceSegs, removeSilence: true })
    expect(result).not.toBeNull()
    expect(result!.message).toContain('81')
  })

  it('counts manual cuts towards the 80-cut limit', () => {
    const manualCuts = Array.from({ length: 81 }, (_, i) => ({ start: i * 3, end: i * 3 + 0.5 }))
    const result = validateExport({ ...baseParams, manualCuts })
    expect(result).not.toBeNull()
    expect(result!.message).toContain('81')
  })

  it('returns null when silence is off even with many silence segs', () => {
    const silenceSegs = Array.from({ length: 100 }, (_, i) => ({ start: i, end: i + 0.5 }))
    expect(validateExport({ ...baseParams, silenceSegs, removeSilence: false })).toBeNull()
  })

  it('returns an error when blur regions exceed 6', () => {
    const blurRegions = Array.from({ length: 7 }, (_, i) => ({ id: i }))
    const result = validateExport({ ...baseParams, blurRegions })
    expect(result).not.toBeNull()
    expect(result!.message).toContain('7')
  })

  it('returns null with exactly 6 blur regions', () => {
    const blurRegions = Array.from({ length: 6 }, (_, i) => ({ id: i }))
    expect(validateExport({ ...baseParams, blurRegions })).toBeNull()
  })

  it('returns null with exactly 80 cuts', () => {
    const silenceSegs = Array.from({ length: 80 }, (_, i) => ({ start: i * 2, end: i * 2 + 0.5 }))
    expect(validateExport({ ...baseParams, silenceSegs, removeSilence: true })).toBeNull()
  })

  it('returns an error for extreme file size', () => {
    const bigFile = { size: 1024 * 1024 * 2000 } as unknown as File
    const result = validateExport({ ...baseParams, file: bigFile, trimStart: 0, trimEnd: 60, duration: 60 })
    expect(result).not.toBeNull()
    expect(result!.message).toContain('MB')
  })

  it('returns an error when trimEnd equals trimStart', () => {
    const result = validateExport({ ...baseParams, trimStart: 5, trimEnd: 5 })
    expect(result).not.toBeNull()
    expect(result!.message).toMatch(/trim range/i)
  })

  it('returns an error when trimEnd is less than trimStart', () => {
    const result = validateExport({ ...baseParams, trimStart: 20, trimEnd: 10 })
    expect(result).not.toBeNull()
    expect(result!.message).toMatch(/trim range/i)
  })

  it('returns null when trimEnd is just above trimStart', () => {
    expect(validateExport({ ...baseParams, trimStart: 0, trimEnd: 0.001 })).toBeNull()
  })
})

describe('formatDate', () => {
  it('returns a non-empty string for a valid timestamp', () => {
    const result = formatDate(Date.UTC(2024, 0, 15, 14, 30))
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes the minute portion in the output', () => {
    const result = formatDate(new Date(2024, 0, 15, 14, 7).getTime())
    expect(result).toMatch(/07/)
  })
})
