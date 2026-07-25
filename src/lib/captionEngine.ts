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
  animation: 'none' | 'scale' | 'bounce' | 'fade' | 'glow' | 'shake' | 'punch' | 'glitch'
  bgEnabled: boolean
  bgColor: string
  bgRadius: number
  bgPerWord?: boolean
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
    description: 'Each word in its own colored box, active word highlights',
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
    bgPerWord: true,
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
  hormozi: {
    id: 'hormozi',
    name: 'Hormozi',
    description: 'Word-by-word pill pop with yellow keyword highlight',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fontSize: 68,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    highlightColor: '#FFEE00',
    strokeColor: '#000000',
    strokeWidth: 5,
    shadowColor: 'rgba(0,0,0,0.9)',
    shadowBlur: 4,
    position: 'center',
    animation: 'punch',
    bgEnabled: true,
    bgColor: 'rgba(0,0,0,0.88)',
    bgRadius: 10,
    wordsPerGroup: 1,
  },
  shake: {
    id: 'shake',
    name: 'Shake',
    description: 'High energy jitter on each word hit',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fontSize: 60,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    highlightColor: '#FF3B30',
    strokeColor: '#000000',
    strokeWidth: 5,
    shadowColor: 'rgba(0,0,0,0.8)',
    shadowBlur: 8,
    position: 'center',
    animation: 'shake',
    bgEnabled: false,
    bgColor: 'rgba(0,0,0,0.0)',
    bgRadius: 0,
    wordsPerGroup: 2,
  },
  smash: {
    id: 'smash',
    name: 'Smash Cut',
    description: 'Slams in large then snaps to size. Ae-inspired',
    fontFamily: '"Arial Black", Impact, sans-serif',
    fontSize: 72,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    highlightColor: '#FF9500',
    strokeColor: '#000000',
    strokeWidth: 6,
    shadowColor: 'rgba(0,0,0,0.9)',
    shadowBlur: 10,
    position: 'center',
    animation: 'punch',
    bgEnabled: false,
    bgColor: 'rgba(0,0,0,0.0)',
    bgRadius: 0,
    wordsPerGroup: 2,
  },
  outlined: {
    id: 'outlined',
    name: 'Outlined',
    description: 'Thick stroke, no bg. Legible on any footage',
    fontFamily: '"Arial Black", "Helvetica Neue", sans-serif',
    fontSize: 54,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    highlightColor: '#FFEE00',
    strokeColor: '#000000',
    strokeWidth: 8,
    shadowColor: 'rgba(0,0,0,0.3)',
    shadowBlur: 2,
    position: 'bottom',
    animation: 'none',
    bgEnabled: false,
    bgColor: 'rgba(0,0,0,0.0)',
    bgRadius: 0,
    wordsPerGroup: 4,
  },
  glitch: {
    id: 'glitch',
    name: 'Glitch',
    description: 'RGB fringe split on active word. Digital Ae look',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fontSize: 58,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    highlightColor: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 4,
    shadowColor: 'rgba(0,0,0,0.7)',
    shadowBlur: 6,
    position: 'center',
    animation: 'glitch',
    bgEnabled: false,
    bgColor: 'rgba(0,0,0,0.0)',
    bgRadius: 0,
    wordsPerGroup: 3,
  },
  typewriter: {
    id: 'typewriter',
    name: 'Typewriter',
    description: 'Words fade in cleanly over a dark subtitle bar',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: 40,
    fontWeight: '700',
    textTransform: 'none',
    color: '#FFFFFF',
    highlightColor: '#00FF88',
    strokeColor: '#000000',
    strokeWidth: 3,
    shadowColor: 'rgba(0,0,0,0.8)',
    shadowBlur: 6,
    position: 'bottom',
    animation: 'fade',
    bgEnabled: true,
    bgColor: 'rgba(0,0,0,0.75)',
    bgRadius: 6,
    wordsPerGroup: 6,
  },
}

/**
 * Groups words into caption groups based on timing and word count.
 * Respects sentence boundaries: groups flush early at sentence-ending
 * punctuation (period, exclamation mark, question mark) once at least
 * half of wordsPerGroup words have accumulated. This prevents captions
 * from being split mid-sentence while still honoring the word count limit.
 */
export function groupWords(words: Word[], wordsPerGroup = 3): CaptionGroup[] {
  if (words.length === 0) return []
  const groups: CaptionGroup[] = []
  const minBeforeBreak = Math.max(1, Math.floor(wordsPerGroup * 0.5))
  let current: Word[] = []

  for (let i = 0; i < words.length; i++) {
    current.push(words[i])
    const isLast = i === words.length - 1
    const endsWithSentence = /[.!?]$/.test(words[i].text.trim())
    const atLimit = current.length >= wordsPerGroup
    const earlyBreak = endsWithSentence && current.length >= minBeforeBreak

    if (atLimit || earlyBreak || isLast) {
      groups.push({
        words: current,
        startTime: current[0].startTime,
        endTime: current[current.length - 1].endTime,
      })
      current = []
    }
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
 *
 * Supports:
 *   - Word wrapping: words that exceed 88% of canvas width wrap to the next line.
 *   - Per-word background boxes (bgPerWord=true): each word gets its own pill;
 *     the active word's box uses highlightColor while inactive words use bgColor.
 *   - Per-line background box (bgPerWord=false): a single rectangle covers the
 *     whole line, matching the classic subtitle style.
 *   - All animation types (scale, bounce, fade, shake, punch, glow, glitch).
 *   - Multi-line vertical centering for top, center, and bottom positions.
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
  // An empty words array would produce a layout loop over zero lines and write
  // nothing to the canvas, but the subsequent ctx.save/restore pairs and font
  // measurement calls are unnecessary. Exit early to keep the render path clean.
  if (activeCaption.group.words.length === 0) return

  const { group, activeWordIndex } = activeCaption
  const texts = style.textTransform === 'uppercase'
    ? group.words.map(w => w.text.toUpperCase())
    : group.words.map(w => w.text)

  ctx.save()
  // Explicitly set text properties so layout is deterministic regardless of
  // prior canvas state. textAlign 'left' ensures curX-based placement is
  // correct for all scripts. textBaseline 'alphabetic' matches the lineBaseY
  // calculation (cap-height offset used for background box geometry).
  ctx.textAlign    = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`

  // Measure every word before layout
  const measured: { text: string; width: number }[] = texts.map(t => ({
    text: t,
    width: ctx.measureText(t).width,
  }))

  const gap = style.fontSize * 0.35
  const maxLineWidth = canvasWidth * 0.88

  // --- Word-wrap: split into lines that each fit within maxLineWidth ---
  const lines: { text: string; width: number }[][] = []
  let currentLine: { text: string; width: number }[] = []
  let currentLineW = 0

  for (const wm of measured) {
    const addW = currentLine.length === 0 ? wm.width : gap + wm.width
    if (currentLine.length > 0 && currentLineW + addW > maxLineWidth) {
      lines.push(currentLine)
      currentLine = [wm]
      currentLineW = wm.width
    } else {
      currentLine.push(wm)
      currentLineW += addW
    }
  }
  if (currentLine.length > 0) lines.push(currentLine)

  // Width of each rendered line
  const lineWidths = lines.map(line =>
    line.reduce((s, wm) => s + wm.width, 0) + gap * Math.max(0, line.length - 1)
  )

  // --- Vertical layout ---
  // firstBaseY is the text baseline of the first wrapped line.
  // For bottom position the last line sits near the bottom edge.
  // For center position the entire block is centered on the canvas.
  const lineHeight = style.fontSize * 1.45
  let firstBaseY: number

  if (style.position === 'top') {
    firstBaseY = canvasHeight * 0.08 + style.fontSize
  } else if (style.position === 'bottom') {
    const lastBaseY = canvasHeight * 0.90
    firstBaseY = lastBaseY - (lines.length - 1) * lineHeight
  } else {
    firstBaseY = canvasHeight * 0.5 - ((lines.length - 1) * lineHeight) / 2
  }

  // Padding values used by background boxes
  const linePad  = style.bgEnabled && !style.bgPerWord ? style.fontSize * 0.4  : 0
  const wordPad  = style.bgEnabled &&  style.bgPerWord ? style.fontSize * 0.15 : 0

  // globalWordIdx maps each word across all wrapped lines back to its original
  // index so it matches activeWordIndex from getActiveCaption.
  let globalWordIdx = 0

  for (let li = 0; li < lines.length; li++) {
    const line     = lines[li]
    const lineW    = lineWidths[li]
    const lineBaseY = firstBaseY + li * lineHeight
    const lineStartX = (canvasWidth - lineW) / 2

    // Per-line background (classic subtitle bar, not per-word)
    if (style.bgEnabled && !style.bgPerWord) {
      const bgX = lineStartX - linePad
      const bgY = lineBaseY - style.fontSize * 0.85 - linePad * 0.5
      const bgW = lineW + linePad * 2
      const bgH = style.fontSize * 1.25 + linePad
      ctx.fillStyle = style.bgColor
      if (style.bgRadius > 0) {
        ctx.beginPath()
        ctx.roundRect(bgX, bgY, bgW, bgH, style.bgRadius)
        ctx.fill()
      } else {
        ctx.fillRect(bgX, bgY, bgW, bgH)
      }
    }

    let curX = lineStartX

    for (let wi = 0; wi < line.length; wi++) {
      const wm       = line[wi]
      const isActive = globalWordIdx === activeWordIndex
      const centerX  = curX + wm.width / 2

      ctx.save()

      // Apply animation transforms and alpha FIRST so that the per-word
      // background box (drawn below) moves and scales with the text rather than
      // remaining anchored at the pre-animation position.
      if (isActive) {
        if (style.animation === 'scale') {
          const scale = 1 + 0.15 * Math.sin(animationProgress * Math.PI)
          ctx.translate(centerX, lineBaseY)
          ctx.scale(scale, scale)
          ctx.translate(-centerX, -lineBaseY)
        } else if (style.animation === 'bounce') {
          ctx.translate(0, -8 * Math.sin(animationProgress * Math.PI))
        } else if (style.animation === 'fade') {
          // Alpha applied before box so both box and text fade in together.
          ctx.globalAlpha = Math.min(1, animationProgress * 4)
        } else if (style.animation === 'shake') {
          const intensity = 3 * (1 - Math.min(1, animationProgress * 2))
          ctx.translate(
            Math.sin(animationProgress * Math.PI * 7) * intensity,
            Math.cos(animationProgress * Math.PI * 5) * intensity,
          )
        } else if (style.animation === 'punch') {
          const overshoot = animationProgress < 0.25
            ? 1.4 - 1.6 * animationProgress
            : 1 + 0.06 * Math.sin((animationProgress - 0.25) * Math.PI / 0.75)
          ctx.translate(centerX, lineBaseY)
          ctx.scale(overshoot, overshoot)
          ctx.translate(-centerX, -lineBaseY)
        }
      }

      // Per-word background box drawn in the already-animated coordinate space
      // so it travels with the text on every animation type.
      if (style.bgEnabled && style.bgPerWord) {
        const boxX = curX - wordPad
        const boxY = lineBaseY - style.fontSize * 0.85 - wordPad * 0.5
        const boxW = wm.width + wordPad * 2
        const boxH = style.fontSize * 1.25 + wordPad
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur  = 0
        ctx.fillStyle = isActive ? style.highlightColor : style.bgColor
        if (style.bgRadius > 0) {
          ctx.beginPath()
          ctx.roundRect(boxX, boxY, boxW, boxH, style.bgRadius)
          ctx.fill()
        } else {
          ctx.fillRect(boxX, boxY, boxW, boxH)
        }
      }

      // Shadow applied before stroke so it halos the stroke outline.
      // Cleared before fill so the fill layer has no double-shadow.
      ctx.shadowColor    = isActive ? style.shadowColor : 'rgba(0,0,0,0.5)'
      ctx.shadowBlur     = isActive ? style.shadowBlur  : style.shadowBlur * 0.5
      ctx.shadowOffsetX  = 0
      ctx.shadowOffsetY  = 2

      // Stroke drawn before fill so the fill paints over the stroke interior,
      // producing a clean outline without fill-color leaking through.
      // Font is inherited from the outer ctx.save() -- no need to reset it.
      if (style.strokeWidth > 0 && style.strokeColor !== 'transparent') {
        ctx.strokeStyle = style.strokeColor
        ctx.lineWidth   = style.strokeWidth
        ctx.lineJoin    = 'round'
        ctx.miterLimit  = 2
        ctx.strokeText(wm.text, curX, lineBaseY)
      }

      // Fill: when bgPerWord is active the colored box conveys the highlight,
      // so text always uses the base color for legibility against the box.
      ctx.shadowColor = 'transparent'
      const fillColor = (style.bgEnabled && style.bgPerWord)
        ? style.color
        : (isActive ? style.highlightColor : style.color)
      ctx.fillStyle = fillColor
      ctx.fillText(wm.text, curX, lineBaseY)

      // Neon glow: extra luminous pass on the active word.
      if (isActive && style.animation === 'glow') {
        ctx.shadowColor = style.highlightColor
        ctx.shadowBlur  = 30 + 10 * Math.sin(animationProgress * Math.PI * 2)
        ctx.fillStyle   = style.highlightColor
        ctx.globalAlpha = 0.6
        ctx.fillText(wm.text, curX, lineBaseY)
        ctx.globalAlpha = 1
      }

      // RGB split glitch: chromatic aberration on the active word.
      if (isActive && style.animation === 'glitch') {
        const offset = 3 + 2 * Math.abs(Math.sin(animationProgress * Math.PI * 6))
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur  = 0
        ctx.globalAlpha = 0.82
        ctx.fillStyle   = '#FF0044'
        ctx.fillText(wm.text, curX - offset, lineBaseY)
        ctx.fillStyle   = '#00EEFF'
        ctx.fillText(wm.text, curX + offset, lineBaseY)
        ctx.globalAlpha = 1
        ctx.fillStyle   = '#FFFFFF'
        ctx.fillText(wm.text, curX, lineBaseY)
      }

      ctx.restore()
      curX += wm.width + gap
      globalWordIdx++
    }
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
