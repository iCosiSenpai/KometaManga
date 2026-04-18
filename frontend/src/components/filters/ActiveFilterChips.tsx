import { X } from 'lucide-react'
import { clsx } from 'clsx'

export interface FilterChip {
  key: string
  label: string
  onRemove: () => void
  tone?: 'default' | 'warn'
}

export function ActiveFilterChips({ chips, className }: { chips: FilterChip[]; className?: string }) {
  if (chips.length === 0) return null
  return (
    <div className={clsx('flex flex-wrap items-center gap-1.5', className)}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className={clsx(
            'group inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors',
            chip.tone === 'warn'
              ? 'bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
              : 'bg-accent-600/15 text-accent-200 hover:bg-accent-600/25',
          )}
          title={`Remove ${chip.label}`}
        >
          {chip.label}
          <X className="h-3 w-3 opacity-70 group-hover:opacity-100" />
        </button>
      ))}
    </div>
  )
}
