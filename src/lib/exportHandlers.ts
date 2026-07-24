export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

export interface ExportValidationParams {
  file:          Pick<File, 'size'>
  trimStart:     number
  trimEnd:       number
  duration:      number
  silenceSegs:   readonly unknown[]
  removeSilence: boolean
  manualCuts:    readonly unknown[]
  blurRegions:   readonly unknown[]
}

export interface ExportValidationError {
  code:    'file-size' | 'trim-range' | 'cut-count' | 'blur-count' | 'duration'
  message: string
}

const MAX_EXPORT_FILE_BYTES = 1.5 * 1024 * 1024 * 1024
const MAX_CUTS              = 80
const MAX_BLUR_REGIONS      = 6

export function validateExport(params: ExportValidationParams): ExportValidationError | null {
  if (!Number.isFinite(params.file.size) || params.file.size < 0) {
    return {
      code:    'file-size',
      message: 'The selected file size could not be read. Choose the video again and retry.',
    }
  }

  if (params.file.size > MAX_EXPORT_FILE_BYTES) {
    const sizeMb = Math.round(params.file.size / (1024 * 1024))
    return {
      code:    'file-size',
      message: `This file is ${sizeMb} MB. Files larger than 1536 MB are not supported for browser export.`,
    }
  }

  if (!Number.isFinite(params.duration) || params.duration <= 0) {
    return {
      code:    'duration',
      message: 'The video duration is not available yet. Wait for the video to finish loading, then retry.',
    }
  }

  if (
    !Number.isFinite(params.trimStart) ||
    !Number.isFinite(params.trimEnd) ||
    params.trimStart < 0 ||
    params.trimEnd <= params.trimStart
  ) {
    return {
      code:    'trim-range',
      message: 'The trim range is invalid. Choose an end time after the start time.',
    }
  }

  if (params.trimEnd > params.duration + 0.05) {
    return {
      code:    'trim-range',
      message: 'The trim range extends beyond the loaded video duration. Adjust the trim handles and retry.',
    }
  }

  const enabledCutCount = (params.removeSilence ? params.silenceSegs.length : 0) + params.manualCuts.length
  if (enabledCutCount > MAX_CUTS) {
    return {
      code:    'cut-count',
      message: `This export contains ${enabledCutCount} cuts. Browser export supports a maximum of ${MAX_CUTS} cuts at once.`,
    }
  }

  if (params.blurRegions.length > MAX_BLUR_REGIONS) {
    return {
      code:    'blur-count',
      message: `This export contains ${params.blurRegions.length} blur regions. Remove some regions and retry. The maximum is ${MAX_BLUR_REGIONS}.`,
    }
  }

  return null
}
