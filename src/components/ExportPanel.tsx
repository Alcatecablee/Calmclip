import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Download, Loader2, CheckCircle2, AlertCircle, Film, FileText } from 'lucide-react'
import { exportVideoWithCaptions } from '@/lib/canvasExporter'
import { generateSRT, generateVTT, downloadSubtitle } from '@/lib/srtExport'
import type { CaptionGroup, CaptionStyle } from '@/lib/captionEngine'
import type { BlurRegion }      from '@/components/FaceBlurPanel'
import type { WatermarkConfig } from '@/components/WatermarkPanel'
import type { SilenceSegment }  from '@/lib/silenceCutter'
import type { CropMode }        from '@/lib/ffmpeg'

const RATIO_PRESETS = [
  { label: '16:9',      desc: 'Landscape',           w: 1920, h: 1080 },
  { label: '9:16',      desc: 'Portrait / TikTok',   w: 1080, h: 1920 },
  { label: '1:1',       desc: 'Square / Instagram',  w: 1080, h: 1080 },
  { label: '4:5',       desc: 'Instagram Feed',      w: 1080, h: 1350 },
  { label: 'Original',  desc: 'Keep source resolution', w: null, h: null },
] as const

interface Props {
  videoRef:       React.RefObject<HTMLVideoElement | null>
  captionGroups:  CaptionGroup[]
  captionStyle:   CaptionStyle
  trimStart:      number
  trimEnd:        number
  cropMode:       CropMode
  blurRegions:    BlurRegion[]
  watermark:      WatermarkConfig | null
  manualCuts:     SilenceSegment[]
  silenceSegs:    SilenceSegment[]
  removeSilence:  boolean
}

export default function ExportPanel({
  videoRef,
  captionGroups,
  captionStyle,
  trimStart,
  trimEnd,
  cropMode,
  blurRegions,
  watermark,
  manualCuts,
  silenceSegs,
  removeSilence,
}: Props) {
  const [phase, setPhase]               = useState<'idle' | 'processing' | 'done'>('idle')
  const [progress, setProgress]         = useState(0)
  const [downloadUrl, setDownloadUrl]   = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [selectedRatio, setSelectedRatio] = useState<string>('Original')

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl) }
  }, [downloadUrl])

  const handleExport = async () => {
    if (!videoRef?.current) {
      setError('No video loaded. Please go back and load a video.')
      return
    }
    setPhase('processing')
    setProgress(0)
    setError(null)
    if (downloadUrl) { URL.revokeObjectURL(downloadUrl); setDownloadUrl(null) }

    const preset = RATIO_PRESETS.find(p => p.label === selectedRatio) || RATIO_PRESETS[4]

    try {
      const blob = await exportVideoWithCaptions({
        videoElement:  videoRef.current,
        captionGroups: captionGroups || [],
        captionStyle,
        targetWidth:   preset.w,
        targetHeight:  preset.h,
        trimStart:     trimStart ?? 0,
        trimEnd:       trimEnd   ?? null,
        cropMode,
        blurRegions:   blurRegions   || [],
        watermark:     watermark     ?? null,
        manualCuts:    manualCuts    || [],
        silenceSegs:   silenceSegs   || [],
        removeSilence: removeSilence ?? false,
        onProgress:    (p) => setProgress(Math.round(p * 100)),
      })
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      setPhase('done')
    } catch (e) {
      setError((e as Error).message || 'Export failed. Please try again.')
      setPhase('idle')
    }
  }

  const handleDownload = () => {
    if (!downloadUrl) return
    const a = document.createElement('a')
    a.href     = downloadUrl
    a.download = `calmclip-export-${Date.now()}.webm`
    a.click()
  }

  return (
    <div className="space-y-3">
      {phase === 'idle' && (
        <>
          {/* Output Ratio */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Output Ratio</p>
            <div className="grid grid-cols-3 gap-1">
              {RATIO_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setSelectedRatio(preset.label)}
                  className="rounded-md px-2 py-1.5 text-center transition-colors"
                  style={{
                    border:     `1px solid ${selectedRatio === preset.label ? 'var(--primary)' : 'var(--border)'}`,
                    background:  selectedRatio === preset.label ? 'var(--primary-a8)' : 'var(--bg-surface)',
                    color:       selectedRatio === preset.label ? 'var(--primary)' : 'var(--text-muted)',
                  }}
                >
                  <div className="text-[11px] font-semibold leading-tight">{preset.label}</div>
                  <div className="text-[9px] leading-tight mt-0.5 opacity-70">{preset.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleExport}
            className="w-full font-semibold"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            <Film className="w-4 h-4 mr-2" />
            Export Video
          </Button>
          {(!captionGroups || captionGroups.length === 0) && (
            <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
              No captions added yet — video will export without captions.
            </p>
          )}
        </>
      )}

      {phase === 'processing' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--primary)' }} />
            <span style={{ color: 'var(--text-muted)' }}>Rendering video with captions...</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-[10px] text-center" style={{ color: 'var(--text-faint)' }}>{progress}%</p>
        </div>
      )}

      {phase === 'done' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm" style={{ color: '#10b981' }}>
            <CheckCircle2 className="w-4 h-4" />
            <span>Export complete</span>
          </div>
          <Button onClick={handleDownload} className="w-full" variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Download Video
          </Button>
          <Button
            onClick={() => { setPhase('idle'); setProgress(0) }}
            variant="ghost"
            size="sm"
            className="w-full text-xs"
          >
            Export Again
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs" style={{ color: '#ef4444' }}>
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}

      {/* Subtitle export */}
      {captionGroups && captionGroups.length > 0 && phase !== 'processing' && (
        <div className="pt-3 space-y-1.5" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Subtitle Files</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => downloadSubtitle(generateSRT(captionGroups), 'captions.srt')}
            >
              <FileText className="w-3 h-3 mr-1" />
              .SRT
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => downloadSubtitle(generateVTT(captionGroups), 'captions.vtt')}
            >
              <FileText className="w-3 h-3 mr-1" />
              .VTT
            </Button>
          </div>
        </div>
      )}

      <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
        Exports use canvas compositing. Captions, blur regions, watermark and cuts are burned in. Output: WebM VP9.
      </p>
    </div>
  )
}
