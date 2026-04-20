import { clsx } from 'clsx'

export type QueueFilter = 'all' | 'active' | 'completed' | 'errors'

export interface QueueFilterTabsProps {
  value: QueueFilter
  counts: Record<QueueFilter, number>
  onChange: (next: QueueFilter) => void
}

const OPTIONS: { key: QueueFilter; label: string }[] = [
  { key: 'all', label: 'Tutti' },
  { key: 'active', label: 'Attivi' },
  { key: 'completed', label: 'Completati' },
  { key: 'errors', label: 'Errori' },
]

export function QueueFilterTabs({ value, counts, onChange }: QueueFilterTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filtro coda">
      {OPTIONS.map((opt) => {
        const active = value === opt.key
        const count = counts[opt.key]
        return (
          <button
            key={opt.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={clsx('ma-chip', active && 'ma-chip-active')}
          >
            <span>{opt.label}</span>
            <span
              className={clsx(
                'font-opsMono text-[10px] tracking-[0.12em]',
                active ? 'ma-muted' : 'ma-faint',
              )}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
