import { exportVideoWithCaptions } from './canvasExporter'
import type { CaptionGroup, CaptionStyle } from './captionEngine'
import type { BlurRegion } from '../components/FaceBlurPanel'
import type { WatermarkConfig } from '../components/WatermarkPanel'
import type { SilenceSegment } from './silenceCutter'
import type { Ratio, CropMode } from './ffmpeg'

export interface BatchProgress {
  ratio:   Ratio
  percent: number
  done:    boolean
  error?:  string
}

const BATCH_RATIOS: { ratio: Ratio; w: number; h: number }[] = [
  { ratio: '16:9', w: 1920, h: 1080 },
  { ratio: '9:16', w: 1080, h: 1920 },
  { ratio: '1:1',  w: 1080, h: 1080 },
  { ratio: '4:5',  w: 1080, h: 1350 },
]

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function batchExport(
  videoElement:  HTMLVideoElement,
  captionGroups: CaptionGroup[],
  captionStyle:  CaptionStyle,
  trimStart:     number,
  trimEnd:       number,
  cropMode:      CropMode,
  blurRegions:   BlurRegion[],
  watermark:     WatermarkConfig | null,
  manualCuts:    SilenceSegment[],
  silenceSegs:   SilenceSegment[],
  removeSilence: boolean,
  baseName:      string,
  onProgress:    (p: BatchProgress[]) => void,
): Promise<void> {
  const progress: BatchProgress[] = BATCH_RATIOS.map(r => ({
    ratio:   r.ratio,
    percent: 0,
    done:    false,
  }))

  onProgress([...progress])

  for (let i = 0; i < BATCH_RATIOS.length; i++) {
    const { ratio, w, h } = BATCH_RATIOS[i]
    try {
      const blob = await exportVideoWithCaptions({
        videoElement,
        captionGroups,
        captionStyle,
        targetWidth:  w,
        targetHeight: h,
        trimStart,
        trimEnd,
        cropMode,
        blurRegions,
        watermark,
        manualCuts,
        silenceSegs,
        removeSilence,
        onProgress: (pct) => {
          progress[i] = { ...progress[i], percent: Math.round(pct * 100) }
          onProgress([...progress])
        },
      })

      const ratioSlug = ratio.replace(':', 'x')
      const fileName  = `${baseName}-${ratioSlug}.webm`
      triggerDownload(blob, fileName)

      progress[i] = { ...progress[i], percent: 100, done: true }
      onProgress([...progress])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      progress[i] = { ...progress[i], error: msg, done: true }
      onProgress([...progress])
    }
  }
}
