import type { Ratio } from '../lib/ffmpeg'

interface Props {
  value:    Ratio
  onChange: (r: Ratio) => void
}

const OPTIONS: { ratio: Ratio; label: string; desc: string; w: number; h: number }[] = [
  { ratio: '16:9', label: '16:9', desc: 'YouTube / Landscape',   w: 32, h: 18 },
  { ratio: '9:16', label: '9:16', desc: 'TikTok / Reels',        w: 18, h: 32 },
  { ratio: '1:1',  label: '1:1',  desc: 'Instagram / Square',    w: 26, h: 26 },
  { ratio: '4:5',  label: '4:5',  desc: 'Instagram Portrait',    w: 20, h: 25 },
]

export default function RatioPicker({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 w-full">
      {OPTIONS.map(o => {
        const active = value === o.ratio
        return (
          <button
            key={o.ratio}
            onClick={() => onChange(o.ratio)}
            className="flex flex-col items-center gap-2 flex-1 py-3"
            style={{
              background:   active ? 'var(--primary-a10)' : 'transparent',
              border:       `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 6,
              cursor:       'pointer',
            }}
          >
            <div
              style={{
                width:        o.w,
                height:       o.h,
                border:       `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 2,
              }}
            />
            <span
              className="text-xs font-semibold"
              style={{ color: active ? 'var(--primary)' : 'var(--text-muted)' }}
            >
              {o.label}
            </span>
            <span className="text-xs text-center leading-tight" style={{ color: 'var(--text-dim)', fontSize: 10 }}>
              {o.desc}
            </span>
          </button>
        )
      })}
    </div>
  )
}
