import { describe, it, expect } from 'vitest'
import { getFileSizeWarning } from '../fileSizeWarning'

const MB = 1024 * 1024

describe('getFileSizeWarning', () => {
  it('returns null for files under 200 MB effective size', () => {
    expect(getFileSizeWarning(100 * MB, 30, 30)).toBeNull()
  })

  it('returns null when trim ratio makes effective size small', () => {
    const bigFile = 2000 * MB
    expect(getFileSizeWarning(bigFile, 1, 100)).toBeNull()
  })

  it('returns "large" tier for effective size 200-499 MB', () => {
    const result = getFileSizeWarning(300 * MB, 30, 30)
    expect(result).not.toBeNull()
    expect(result!.tier).toBe('large')
    expect(result!.message).toContain('MB')
    expect(result!.hint).toBeTruthy()
  })

  it('returns "very-large" tier for effective size 500-1023 MB', () => {
    const result = getFileSizeWarning(700 * MB, 30, 30)
    expect(result).not.toBeNull()
    expect(result!.tier).toBe('very-large')
  })

  it('returns "extreme" tier for effective size >= 1024 MB', () => {
    const result = getFileSizeWarning(1100 * MB, 30, 30)
    expect(result).not.toBeNull()
    expect(result!.tier).toBe('extreme')
    expect(result!.message).toContain('MB')
  })

  it('applies trim ratio to effective size', () => {
    // 2500 MB * (10 / 100) = 250 MB effective, which is in the "large" tier
    const bytes = 2500 * MB
    const fullDur = 100
    const trimmedDur = 10
    const result = getFileSizeWarning(bytes, trimmedDur, fullDur)
    expect(result).not.toBeNull()
    expect(result!.sizeMB).toBe(Math.round(2500 * (10 / 100)))
    expect(result!.tier).toBe('large')
  })

  it('uses full size when totalDuration is zero', () => {
    const result = getFileSizeWarning(500 * MB, 30, 0)
    expect(result).not.toBeNull()
    expect(result!.tier).toBe('very-large')
  })

  it('sizeMB in result matches rounded effective MB', () => {
    const result = getFileSizeWarning(250 * MB, 30, 30)
    expect(result!.sizeMB).toBe(250)
  })

  it('returns null at exactly 199 MB effective', () => {
    expect(getFileSizeWarning(199 * MB, 30, 30)).toBeNull()
  })

  it('returns "large" at exactly 200 MB effective', () => {
    const result = getFileSizeWarning(200 * MB, 30, 30)
    expect(result!.tier).toBe('large')
  })
})
