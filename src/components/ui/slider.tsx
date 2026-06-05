import { cn } from '@/lib/utils'

interface SliderProps {
  value: number[]
  min?: number
  max?: number
  step?: number
  onValueChange: (value: number[]) => void
  className?: string
}

function Slider({ value, min = 0, max = 100, step = 1, onValueChange, className }: SliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0]}
      onChange={e => onValueChange([Number(e.target.value)])}
      className={cn('w-full cursor-pointer', className)}
      style={{ accentColor: 'var(--primary)' }}
    />
  )
}

export { Slider }
