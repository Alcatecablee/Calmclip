export type FileSizeTier = 'ok' | 'large' | 'very-large' | 'extreme'

export interface FileSizeWarning {
  tier:    FileSizeTier
  sizeMB:  number
  message: string
  hint:    string
}

const MB = 1024 * 1024

export function getFileSizeWarning(bytes: number, trimDuration: number, totalDuration: number): FileSizeWarning | null {
  const sizeMB = bytes / MB

  const trimRatio   = totalDuration > 0 ? trimDuration / totalDuration : 1
  const effectiveMB = sizeMB * trimRatio

  if (effectiveMB < 200) return null

  if (effectiveMB >= 1024) {
    return {
      tier:    'extreme',
      sizeMB:  Math.round(effectiveMB),
      message: `Effective clip size is ~${Math.round(effectiveMB)} MB. The browser may run out of memory.`,
      hint:    'Trim to a much shorter section before exporting to avoid a crash.',
    }
  }

  if (effectiveMB >= 500) {
    const minLow  = Math.round(effectiveMB / 60)
    const minHigh = Math.round(effectiveMB / 35)
    return {
      tier:    'very-large',
      sizeMB:  Math.round(effectiveMB),
      message: `Effective clip size is ~${Math.round(effectiveMB)} MB. Expect ${minLow}-${minHigh} min to export.`,
      hint:    'Trimming to a shorter section will speed this up significantly.',
    }
  }

  const secLow  = Math.round(effectiveMB * 0.3)
  const secHigh = Math.round(effectiveMB * 0.6)
  return {
    tier:    'large',
    sizeMB:  Math.round(effectiveMB),
    message: `Effective clip size is ~${Math.round(effectiveMB)} MB. Expect ${secLow}-${secHigh}s to export.`,
    hint:    'Estimates vary by CPU and resolution.',
  }
}
