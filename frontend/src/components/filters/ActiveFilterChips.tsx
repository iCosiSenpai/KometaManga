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
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className={clsx(
            'group inline-flex items-center gap-1.5 rounded-full border ma-hair px-2.5 py-1 text-[11px] transition-colors',
            chip.tone === 'warn' ? 'ma-warn' : 'ma-muted',
            'hover:ma-text hover:border-[var(--ma-hair-strong)]',
          )}
          title={`Rimuovi: ${chip.label}`}
        >
          {chip.label}
          <X className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100 group-hover:ma-accent" />
        </button>
      ))}
    </div>
  )
}
