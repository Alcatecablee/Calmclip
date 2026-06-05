import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50'

    const variants: Record<string, string> = {
      default: 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90',
      outline:
        'border border-[var(--border)] bg-transparent hover:bg-[var(--bg-surface)] text-[var(--text-primary)]',
      ghost: 'hover:bg-[var(--bg-surface)] text-[var(--text-muted)]',
      secondary:
        'bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] border border-[var(--border)]',
      destructive: 'bg-red-500 text-white hover:bg-red-600',
      link: 'underline-offset-4 hover:underline text-[var(--primary)] p-0 h-auto',
    }

    const sizes: Record<string, string> = {
      default: 'h-10 px-4 py-2 text-sm',
      sm: 'h-9 rounded-md px-3 text-xs',
      lg: 'h-11 rounded-md px-8 text-base',
      icon: 'h-10 w-10',
    }

    return (
      <button
        ref={ref}
        type={type}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
