import { cn } from '@/lib/utils'

interface ProgressProps {
  value?: number
  className?: string
}

function Progress({ value = 0, className }: ProgressProps) {
  return (
    <div
      className={cn(
        'relative h-4 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]',
        className
      )}
      style={{ border: '1px solid var(--border)' }}
    >
      <div
        className="h-full bg-[var(--primary)] transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export { Progress }
