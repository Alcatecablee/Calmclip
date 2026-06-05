import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface SelectContextValue {
  value: string
  onValueChange: (v: string) => void
  open: boolean
  setOpen: (v: boolean) => void
  labels: Map<string, string>
  registerLabel: (value: string, label: string) => void
}

const SelectContext = createContext<SelectContextValue>({} as SelectContextValue)

function Select({
  value,
  onValueChange,
  children,
}: {
  value: string
  onValueChange: (v: string) => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [labels, setLabels] = useState<Map<string, string>>(new Map())
  const ref = useRef<HTMLDivElement>(null)

  const registerLabel = (v: string, label: string) => {
    setLabels(prev => {
      if (prev.get(v) === label) return prev
      return new Map(prev).set(v, label)
    })
  }

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, labels, registerLabel }}>
      <div ref={ref} className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

function SelectTrigger({ children, className }: { children?: ReactNode; className?: string }) {
  const { open, setOpen } = useContext(SelectContext)
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none',
        className
      )}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
    </button>
  )
}

function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value, labels } = useContext(SelectContext)
  return <span>{labels.get(value) ?? value ?? placeholder ?? ''}</span>
}

function SelectContent({ children, className }: { children: ReactNode; className?: string }) {
  const { open } = useContext(SelectContext)
  // Always render so SelectItem useEffects fire and labels get registered.
  // Use display:none to hide — never return null (that unmounts items and clears labels).
  return (
    <div
      className={cn(
        'absolute z-50 w-full mt-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg overflow-hidden',
        className
      )}
      style={{ display: open ? 'block' : 'none' }}
    >
      {children}
    </div>
  )
}

function SelectItem({
  value: itemValue,
  children,
  className,
}: {
  value: string
  children: ReactNode
  className?: string
}) {
  const { onValueChange, setOpen, value, registerLabel } = useContext(SelectContext)

  useEffect(() => {
    if (typeof children === 'string') {
      registerLabel(itemValue, children)
    }
  }, [itemValue, children])

  return (
    <div
      className={cn(
        'relative flex cursor-pointer select-none items-center px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]',
        value === itemValue && 'bg-[var(--bg-surface-2)] font-medium',
        className
      )}
      onClick={() => {
        onValueChange(itemValue)
        setOpen(false)
      }}
    >
      {children}
    </div>
  )
}

SelectTrigger.displayName = 'SelectTrigger'
SelectValue.displayName = 'SelectValue'
SelectContent.displayName = 'SelectContent'
SelectItem.displayName = 'SelectItem'

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
