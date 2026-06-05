/**
 * Caption Engine: handles transcription, word timing, and canvas rendering.
 * Uses a direct Canvas composite approach for export (no PNG burn-in, no FFmpeg overlay).
 * Captions are drawn in real-time onto a canvas, then captured via MediaRecorder.
 */

export interface Word {
  text: string
  startTime: number
  endTime: number
}

export interface CaptionGroup {
  words: Word[]
  startTime: number
  endTime: number
}

export interface ActiveCaption {
  group: CaptionGroup
  groupIndex: number
  activeWordIndex: number
}

export interface CaptionStyle {
  id: string
  name: string
  description: string
  fontFamily: string
  fontSize: number
  fontWeight: string
  textTransform: 'uppercase' | 'none'
  color: string
  highlightColor: string
  strokeColor: string
  strokeWidth: number
  shadowColor: string
  shadowBlur: number
  position: 'top' | 'center' | 'bottom'
  animation: 'none' | 'scale' | 'bounce' | 'fade' | 'glow'
  bgEnabled: boolean
  bgColor: string
  bgRadius: number
  wordsPerGroup: number
}

// Caption style presets (TikTok-inspired)
export const CAPTION_PRESETS: Record<string, CaptionStyle> = {
  boldPop: {
    id: 'boldPop',
    name: 'Bold Pop',
    description: 'Big, bold, punchy text with color highlight',
    fontFamily: 'Impact, Arial Black, sans-serif',
    fontSize: 64,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    highlightColor: '#FF2D55',
    strokeColor: '#000000',
    strokeWidth: 6,
    shadowColor: 'rgba(0,0,0,0.8)',
    shadowBlur: 12,
    position: 'center',
    animation: 'scale',
    bgEnabled: false,
    bgColor: 'rgba(0,0,0,0.0)',
    bgRadius: 0,
    wordsPerGroup: 3,
  },
  karaoke: {
    id: 'karaoke',
    name: 'Karaoke',
    description: 'Word-by-word color fill like singing along',
    fontFamily: '"Arial Black", "Helvetica Neue", sans-serif',
    fontSize: 56,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    highlightColor: '#FFEE00',
    strokeColor: '#000000',
    strokeWidth: 4,
    shadowColor: 'rgba(0,0,0,0.6)',
    shadowBlur: 8,
    position: 'center',
    animation: 'none',
    bgEnabled: false,
    bgColor: 'rgba(0,0,0,0.0)',
    bgRadius: 0,
    wordsPerGroup: 4,
  },
  boxed: {
    id: 'boxed',
    name: 'Boxed',
    description: 'Each word in a colored box, highlight swaps color',
    fontFamily: '"Inter", "Helvetica Neue", sans-serif',
    fontSize: 48,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    highlightColor: '#FF2D55',
    strokeColor: 'transparent',
    strokeWidth: 0,
    shadowColor: 'rgba(0,0,0,0.4)',
    shadowBlur: 6,
    position: 'center',
    animation: 'bounce',
    bgEnabled: true,
    bgColor: '#1a1a2e',
    bgRadius: 12,
    wordsPerGroup: 3,
  },
  neon: {
    id: 'neon',
    name: 'Neon Glow',
    description: 'Glowing neon text, highlighted word pulses',
    fontFamily: '"Arial Black", "Helvetica Neue", sans-serif',
    fontSize: 52,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    highlightColor: '#00E5FF',
    strokeColor: '#00E5FF',
    strokeWidth: 2,
    shadowColor: '#00E5FF',
    shadowBlur: 20,
    position: 'center',
    animation: 'glow',
    bgEnabled: false,
    bgColor: 'rgba(0,0,0,0.0)',
    bgRadius: 0,
    wordsPerGroup: 3,
  },
  minimal: {
    id: 'minimal',
    name: 'Clean Minimal',
    description: 'Simple clean text, subtle highlight',
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSize: 44,
    fontWeight: '600',
    textTransform: 'none',
    color: '#FFFFFF',
    highlightColor: '#FF6B6B',
    strokeColor: '#000000',
    strokeWidth: 3,
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowBlur: 4,
    position: 'bottom',
    animation: 'fade',
    bgEnabled: true,
    bgColor: 'rgba(0,0,0,0.6)',
    bgRadius: 8,
    wordsPerGroup: 5,
  },
  fire: {
    id: 'fire',
    name: 'Fire',
    description: 'Fiery orange-red highlights with energy',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fontSize: 60,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    highlightColor: '#FF6B00',
    strokeColor: '#8B0000',
    strokeWidth: 5,
    shadowColor: '#FF4500',
    shadowBlur: 16,
    position: 'center',
    animation: 'scale',
    bgEnabled: false,
    bgColor: 'rgba(0,0,0,0.0)',
    bgRadius: 0,
    wordsPerGroup: 3,
  },
}

/**
 * Groups words into caption groups based on timing and word count.
 */
export function groupWords(words: Word[], wordsPerGroup = 3): CaptionGroup[] {
  const groups: CaptionGroup[] = []
  for (let i = 0; i < words.length; i += wordsPerGroup) {
    const chunk = words.slice(i, i + wordsPerGroup)
    groups.push({
      words: chunk,
      startTime: chunk[0].startTime,
      endTime: chunk[chunk.length - 1].endTime,
    })
  }
  return groups
}

/**
 * Get the currently active caption group and highlighted word index.
 */
export function getActiveCaption(groups: CaptionGroup[], currentTime: number): ActiveCaption | null {
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]
    if (currentTime >= group.startTime && currentTime <= group.endTime) {
      let activeWordIndex = -1
      for (let wi = 0; wi < group.words.length; wi++) {
        const w = group.words[wi]
        if (currentTime >= w.startTime && currentTime <= w.endTime) {
          activeWordIndex = wi
          break
        }
      }
      return { group, groupIndex: gi, activeWordIndex }
    }
  }
  return null
}

/**
 * Draw captions onto a 2D canvas context.
 * This is the core renderer, used both for preview overlay and export compositing.
 */
export function drawCaptions(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  activeCaption: ActiveCaption,
  style: CaptionStyle,
  animationProgress = 0,
): void {
  if (!activeCaption || !activeCaption.group) return

  const { group, activeWordIndex } = activeCaption
  const text = style.textTransform === 'uppercase'
    ? group.words.map(w => w.text.toUpperCase())
    : group.words.map(w => w.text)

  ctx.save()

  // Measure text
  ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`
  const wordMetrics = text.map(t => ({
    text: t,
    width: ctx.measureText(t).width,
  }))
  const gap = style.fontSize * 0.35
  const totalWidth = wordMetrics.reduce((s, m) => s + m.width, 0) + gap * (wordMetrics.length - 1)

  // Position
  let baseY: number
  if (style.position === 'top') {
    baseY = canvasHeight * 0.15
  } else if (style.position === 'bottom') {
    baseY = canvasHeight * 0.82
  } else {
    baseY = canvasHeight * 0.5
  }

  const startX = (canvasWidth - totalWidth) / 2

  // Draw background if enabled
  if (style.bgEnabled) {
    const padding = style.fontSize * 0.4
    const bgX = startX - padding
    const bgY = baseY - style.fontSize * 0.8 - padding * 0.5
    const bgW = totalWidth + padding * 2
    const bgH = style.fontSize * 1.2 + padding

    ctx.fillStyle = style.bgColor
    if (style.bgRadius > 0) {
      ctx.beginPath()
      ctx.roundRect(bgX, bgY, bgW, bgH, style.bgRadius)
      ctx.fill()
    } else {
      ctx.fillRect(bgX, bgY, bgW, bgH)
    }
  }

  // Draw each word
  let currentX = startX
  for (let i = 0; i < wordMetrics.length; i++) {
    const isActive = i === activeWordIndex
    const word = wordMetrics[i]

    ctx.save()

    // Animation for active word
    if (isActive) {
      const centerX = currentX + word.width / 2
      const centerY = baseY

      if (style.animation === 'scale') {
        const scale = 1 + 0.15 * Math.sin(animationProgress * Math.PI)
        ctx.translate(centerX, centerY)
        ctx.scale(scale, scale)
        ctx.translate(-centerX, -centerY)
      } else if (style.animation === 'bounce') {
        const bounce = -8 * Math.sin(animationProgress * Math.PI)
        ctx.translate(0, bounce)
      }
    }

    // Shadow
    ctx.shadowColor = isActive ? style.shadowColor : 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = isActive ? style.shadowBlur : style.shadowBlur * 0.5
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 2

    // Stroke
    if (style.strokeWidth > 0 && style.strokeColor !== 'transparent') {
      ctx.strokeStyle = style.strokeColor
      ctx.lineWidth = style.strokeWidth
      ctx.lineJoin = 'round'
      ctx.miterLimit = 2
      ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`
      ctx.strokeText(word.text, currentX, baseY)
    }

    // Fill
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = isActive ? style.highlightColor : style.color
    ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`
    ctx.fillText(word.text, currentX, baseY)

    // Neon glow extra pass for active
    if (isActive && style.animation === 'glow') {
      ctx.shadowColor = style.highlightColor
      ctx.shadowBlur = 30 + 10 * Math.sin(animationProgress * Math.PI * 2)
      ctx.fillStyle = style.highlightColor
      ctx.globalAlpha = 0.6
      ctx.fillText(word.text, currentX, baseY)
      ctx.globalAlpha = 1
    }

    ctx.restore()
    currentX += word.width + gap
  }

  ctx.restore()
}

/**
 * Parse simple manual captions text into word objects with timing.
 * Format: "word1 word2 word3" with equal time distribution.
 */
export function parseManualCaptions(text: string, startTime: number, endTime: number): Word[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const duration = endTime - startTime
  const wordDuration = duration / words.length
  return words.map((word, i) => ({
    text: word,
    startTime: startTime + i * wordDuration,
    endTime: startTime + (i + 1) * wordDuration,
  }))
}
