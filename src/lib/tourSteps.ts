import { VolumeX, Maximize2, EyeOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type TabType = 'silence' | 'crop' | 'blur'

export interface TourTab {
  id:    TabType
  label: string
  Icon:  LucideIcon
}

export const TOUR_TABS: TourTab[] = [
  { id: 'silence', label: 'Silence Cutter', Icon: VolumeX   },
  { id: 'crop',    label: 'Smart Crop',     Icon: Maximize2 },
  { id: 'blur',    label: 'Face Blur',      Icon: EyeOff    },
]

export const WAVEFORM_BARS: readonly number[] = [
  40, 60, 20, 5, 5, 80, 70, 90, 10, 5, 5, 50, 45, 85, 95, 10, 5, 5, 60, 80, 5, 5, 75, 85, 15, 5, 5, 45, 30,
]

export interface CropRatioOption {
  id:    '16:9' | '9:16' | '1:1'
  label: string
}

export const CROP_RATIO_OPTIONS: CropRatioOption[] = [
  { id: '16:9', label: '16:9 Landscape'    },
  { id: '9:16', label: '9:16 Vertical Reel' },
  { id: '1:1',  label: '1:1 Square'        },
]

export interface CropModeOption {
  id:    'fill' | 'fit'
  label: string
}

export const CROP_MODE_OPTIONS: CropModeOption[] = [
  { id: 'fill', label: 'Fill (Smart Center)' },
  { id: 'fit',  label: 'Fit (Letterbox)'     },
]

export function getSilentSegments(threshold: number): { start: number; end: number }[] {
  if (threshold < -45) {
    return [
      { start: 25, end: 32 },
      { start: 70, end: 77 },
    ]
  }
  if (threshold < -30) {
    return [
      { start: 12, end: 20 },
      { start: 35, end: 44 },
      { start: 58, end: 66 },
      { start: 80, end: 88 },
    ]
  }
  return [
    { start: 8,  end: 18 },
    { start: 24, end: 34 },
    { start: 40, end: 50 },
    { start: 56, end: 66 },
    { start: 72, end: 82 },
    { start: 86, end: 94 },
  ]
}
