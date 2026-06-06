export interface TimedChunk {
  text:      string
  timestamp: [number, number | null]
}

export interface CaptionStyle {
  id:            string
  label:         string
  description:   string
  fontsize:      number
  fontcolor:     string
  yExpr:         string
  xExpr?:        string
  boxEnabled:    boolean
  boxcolor:      string
  boxOpacity:    number
  boxPad:        number
  borderW:       number
  borderColor:   string
  textTransform?:   'uppercase' | 'none'
  textShadow?:      string
  rotation?:        number
  fontsizeScale?:   number
  wordsPerGroup?:   number
  timingOffset?:    number
  alignment?:       'left' | 'center' | 'right'
  highlightColor?:  string
  fontFile?:        string
}

const NAMED_COLORS: Record<string, string> = {
  white:   '0xFFFFFF',
  black:   '0x000000',
  red:     '0xFF0000',
  green:   '0x008000',
  blue:    '0x0000FF',
  yellow:  '0xFFFF00',
  cyan:    '0x00FFFF',
  magenta: '0xFF00FF',
  gray:    '0x808080',
  grey:    '0x808080',
  orange:  '0xFFA500',
  pink:    '0xFFC0CB',
  purple:  '0x800080',
  silver:  '0xC0C0C0',
  lime:    '0x00FF00',
  navy:    '0x000080',
  teal:    '0x008080',
  maroon:  '0x800000',
}

function cssToFfmpegColor(c: string): string {
  if (c.startsWith('#')) return '0x' + c.slice(1).toUpperCase()
  const named = NAMED_COLORS[c.toLowerCase()]
  if (named) return named
  return c
}

export function escapeFfmpegText(s: string): string {
  return s
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\u2019')
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/,/g, '\\,')
    .replace(/%/g, '%%')
}

export const FFMPEG_FONT_PATH = 'caption-font.ttf'

export const CAPTION_FONTS: { file: string; label: string; hint: string }[] = [
  { file: 'caption-font.ttf',     label: 'Default', hint: 'Clean sans-serif' },
  { file: 'oswald-bold.ttf',      label: 'Bold',    hint: 'Condensed, high impact' },
  { file: 'roboto-mono-bold.ttf', label: 'Mono',    hint: 'Fixed-width, technical' },
  { file: 'pacifico.ttf',         label: 'Script',  hint: 'Rounded, friendly' },
]

function alignXExpr(alignment: 'left' | 'center' | 'right' | undefined): string {
  if (alignment === 'left')  return 'w*0.04'
  if (alignment === 'right') return 'w-text_w-w*0.04'
  return '(w-text_w)/2'
}

function resolveXExpr(style: CaptionStyle): string {
  if (style.alignment === 'left' || style.alignment === 'right') {
    return alignXExpr(style.alignment)
  }
  return style.xExpr ?? '(w-text_w)/2'
}

function parseShadowToken(s: string): { color: string; x: number; y: number } | null {
  const allNums = s.match(/-?[\d.]+(?:px)?/g) ?? []
  const nums: number[] = []
  for (const n of allNums) {
    nums.push(parseFloat(n))
    if (nums.length >= 2) break
  }
  if (nums.length < 2) return null
  const x = Math.round(nums[0])
  const y = Math.round(nums[1])

  let color = '0x000000'
  const hexMatch = s.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/)
  if (hexMatch) {
    let h = hexMatch[1]
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]
    color = '0x' + h.toUpperCase()
  } else {
    const rgbaMatch = s.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0')
      const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0')
      const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0')
      color = '0x' + (r + g + b).toUpperCase()
    }
  }
  return { color, x, y }
}

function ffmpegYExpr(yExpr: string, boxEnabled: boolean, boxPad: number): string {
  const m = /h\*([\d.]+)/.exec(yExpr)
  if (!m) return yExpr
  const yFrac = parseFloat(m[1])
  const pad = boxEnabled ? boxPad : 0
  if (pad > 0) return `h*${yFrac.toFixed(3)}-text_h-${pad}`
  return `h*${yFrac.toFixed(3)}-text_h`
}

export function parseFfmpegShadow(textShadow: string | undefined): { color: string; x: number; y: number } | null {
  if (!textShadow) return null
  const shadows: string[] = []
  let depth = 0, start = 0
  for (let i = 0; i <= textShadow.length; i++) {
    const c = textShadow[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if ((c === ',' || i === textShadow.length) && depth === 0) {
      const seg = textShadow.slice(start, i).trim()
      if (seg) shadows.push(seg)
      start = i + 1
    }
  }
  for (const shadow of shadows) {
    const result = parseShadowToken(shadow)
    if (result && (result.x !== 0 || result.y !== 0)) return result
  }
  return null
}

export function buildCaptionFilter(text: string, style: CaptionStyle): string {
  if (!text.trim()) return ''
  const SPECIAL_TOKEN_RE = /\[.*?\]|<\|[^|]+\|>/g
  let processedText = text.replace(SPECIAL_TOKEN_RE, '').trim()
  if (!processedText) return ''
  if (style.textTransform === 'uppercase') {
    processedText = processedText.toUpperCase()
  }
  const safe   = escapeFfmpegText(processedText)
  const xExpr  = resolveXExpr(style)
  const shadow = parseFfmpegShadow(style.textShadow)
  const parts: string[] = [
    `fontfile=${style.fontFile ?? FFMPEG_FONT_PATH}`,
    `text=${safe}`,
    `fontsize=${style.fontsize}`,
    `fontcolor=${cssToFfmpegColor(style.fontcolor)}`,
    `x=${xExpr}`,
    `y=${ffmpegYExpr(style.yExpr, style.boxEnabled, style.boxPad)}`,
    'fix_bounds=1',
  ]
  if (style.boxEnabled) {
    parts.push('box=1')
    parts.push(`boxcolor=${cssToFfmpegColor(style.boxcolor)}@${style.boxOpacity.toFixed(2)}`)
    parts.push(`boxborderw=${style.boxPad}`)
  }
  if (style.borderW > 0) {
    parts.push(`borderw=${style.borderW}`)
    parts.push(`bordercolor=${cssToFfmpegColor(style.borderColor)}`)
  }
  if (shadow) {
    parts.push(`shadowcolor=${shadow.color}`)
    parts.push(`shadowx=${shadow.x}`)
    parts.push(`shadowy=${shadow.y}`)
  }
  return `drawtext=${parts.join(':')}`
}

export const CAPTION_PRESETS: CaptionStyle[] = [
  {
    id:          'standard',
    label:       'Studio',
    description: 'White with a crisp stacked shadow, no box',
    fontsize:    56,
    fontcolor:   'white',
    yExpr:       'h*0.83',
    xExpr:       '(w-text_w)/2',
    boxEnabled:  false,
    boxcolor:    'black',
    boxOpacity:  0,
    boxPad:      0,
    borderW:     0,
    borderColor: 'black',
    textShadow:  '2px 2px 0 #000, 0 4px 12px rgba(0,0,0,0.95)',
    textTransform: 'none',
  },
  {
    id:          'basic',
    label:       'Clean',
    description: 'White in a deep translucent pill',
    fontsize:    50,
    fontcolor:   'white',
    yExpr:       'h*0.83',
    xExpr:       '(w-text_w)/2',
    boxEnabled:  true,
    boxcolor:    '#08080d',
    boxOpacity:  0.84,
    boxPad:      18,
    borderW:     0,
    borderColor: 'black',
    textTransform: 'none',
  },
  {
    id:          'blast',
    label:       'Neon',
    description: 'White with a violet neon outline',
    fontsize:    58,
    fontcolor:   '#ffffff',
    yExpr:       'h*0.76',
    xExpr:       '(w-text_w)/2',
    boxEnabled:  false,
    boxcolor:    'black',
    boxOpacity:  0,
    boxPad:      0,
    borderW:     2,
    borderColor: '#03a9f4',
    textShadow:  '0 0 8px #29b6f6, 0 0 16px #03a9f4',
    textTransform: 'uppercase',
  },
  {
    id:          'blocks',
    label:       'Teal',
    description: 'Bold white on a deep teal box',
    fontsize:    52,
    fontcolor:   '#ffffff',
    yExpr:       'h*0.81',
    xExpr:       '(w-text_w)/2',
    boxEnabled:  true,
    boxcolor:    '#0d9488',
    boxOpacity:  1.0,
    boxPad:      14,
    borderW:     0,
    borderColor: 'black',
    textTransform: 'uppercase',
  },
  {
    id:          'loud',
    label:       'Rush',
    description: 'White on rich emerald, full bleed',
    fontsize:    54,
    fontcolor:   '#ffffff',
    yExpr:       'h*0.77',
    xExpr:       '(w-text_w)/2',
    boxEnabled:  true,
    boxcolor:    '#059669',
    boxOpacity:  1.0,
    boxPad:      14,
    borderW:     0,
    borderColor: 'black',
    textTransform: 'uppercase',
  },
  {
    id:          'modern',
    label:       'Fire',
    description: 'White on a bold deep crimson box',
    fontsize:    54,
    fontcolor:   '#ffffff',
    yExpr:       'h*0.80',
    xExpr:       '(w-text_w)/2',
    boxEnabled:  true,
    boxcolor:    '#b91c1c',
    boxOpacity:  1.0,
    boxPad:      14,
    borderW:     0,
    borderColor: 'black',
    textTransform: 'uppercase',
  },
  {
    id:          'outline',
    label:       'Punch',
    description: 'White with a heavy black stroke, no box',
    fontsize:    64,
    fontcolor:   '#ffffff',
    yExpr:       'h*0.77',
    xExpr:       '(w-text_w)/2',
    boxEnabled:  false,
    boxcolor:    'black',
    boxOpacity:  0,
    boxPad:      0,
    borderW:     5,
    borderColor: '#000000',
    textTransform: 'uppercase',
  },
  {
    id:          'ribbon',
    label:       'Night',
    description: 'White in a deep navy banner',
    fontsize:    48,
    fontcolor:   '#ffffff',
    yExpr:       'h*0.83',
    xExpr:       '(w-text_w)/2',
    boxEnabled:  true,
    boxcolor:    '#0f172a',
    boxOpacity:  0.88,
    boxPad:      20,
    borderW:     0,
    borderColor: 'black',
    textTransform: 'none',
  },
  {
    id:          'karaoke',
    label:       'Karaoke',
    description: 'White on black pill, yellow highlight word',
    fontsize:    54,
    fontcolor:   '#ffffff',
    yExpr:       'h*0.83',
    xExpr:       '(w-text_w)/2',
    boxEnabled:  true,
    boxcolor:    '#08080d',
    boxOpacity:  0.90,
    boxPad:      16,
    borderW:     0,
    borderColor: 'black',
    textTransform: 'none',
    highlightColor: '#fde047',
  },
]

export const DEFAULT_CAPTION_STYLE: CaptionStyle = CAPTION_PRESETS[0]

export function groupChunksByWords(chunks: TimedChunk[], maxWords: number): TimedChunk[] {
  if (chunks.length === 0) return []
  const result: TimedChunk[] = []
  let groupBuf: TimedChunk[] = []
  let wordCount = 0
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]
    const wc = c.text.trim().split(/\s+/).filter(Boolean).length
    wordCount += wc
    groupBuf.push(c)
    const isLast        = i === chunks.length - 1
    const endsWithPunct = /[.!?,]$/.test(c.text.trim())
    if (endsWithPunct || wordCount >= maxWords || isLast) {
      const text = groupBuf.map(g => g.text).join(' ').replace(/\s+/g, ' ').trim()
      const t0   = groupBuf[0].timestamp[0]
      const last = groupBuf[groupBuf.length - 1]
      const t1   = last.timestamp[1] ?? (last.timestamp[0] != null ? last.timestamp[0] + 0.5 : null)
      result.push({ text, timestamp: [t0, t1] })
      groupBuf  = []
      wordCount = 0
    }
  }
  return result
}

export async function ensureFontLoaded(style: CaptionStyle): Promise<void> {
  if (typeof window === 'undefined' || typeof FontFace === 'undefined') return

  const fontFamilyMap: Record<string, string> = {
    'oswald-bold.ttf':      'Oswald',
    'roboto-mono-bold.ttf': 'Roboto Mono',
    'pacifico.ttf':         'Pacifico',
  }
  const fontFamily = fontFamilyMap[style.fontFile ?? ''] ?? 'Roboto'
  const fontFile   = style.fontFile ?? 'caption-font.ttf'

  try {
    const isLoaded = document.fonts.check(`12px "${fontFamily}"`)
    if (isLoaded) return
  } catch {
    // Proceed to load if font check is not supported
  }

  try {
    const font = new FontFace(fontFamily, `url(/${fontFile})`)
    const loadedFont = await font.load()
    document.fonts.add(loadedFont)
  } catch (err) {
    console.warn(`[CalmClip] Failed to load font ${fontFamily} from /${fontFile}`, err)
  }
}
