import { useEffect } from 'react'
import { X } from 'lucide-react'
import { SourcesFilterRail, type SourcesFilterRailProps } from './SourcesFilterRail'
import type { MangaSourceId } from '@/api/sources'

export interface SourcesFilterDrawerProps extends SourcesFilterRailProps {
  open: boolean
  onClose: () => void
  onReset: () => void
}

export function SourcesFilterDrawer({ open, onClose, onReset, ...railProps }: SourcesFilterDrawerProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const activeFilterCount = countActiveFilters(railProps)

  return (
    <div className="lg:hidden">
      <div
        className="fixed inset-0 z-40 animate-fade-in bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Filtri"
        className="ma-drawer-panel animate-slide-in-left fixed left-0 top-0 bottom-0 z-50 flex w-[86vw] max-w-[340px] flex-col"
      >
        <header className="flex items-center justify-between border-b ma-hair px-5 py-4">
          <span className="font-opsMono text-[11px] uppercase tracking-[0.22em] ma-faint">
            フィルター · Filtri
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 ma-faint transition-colors hover:ma-text"
            aria-label="Chiudi filtri"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <SourcesFilterRail {...railProps} />
        </div>

        <footer className="flex items-center justify-between gap-3 border-t ma-hair bg-[var(--ma-surface)] px-5 py-4">
          <button
            type="button"
            onClick={onReset}
            className="ma-microlink"
            disabled={activeFilterCount === 0}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-sm border ma-hair-strong bg-[color:var(--ma-surface-2)] px-4 py-2 font-opsMono text-[11px] uppercase tracking-[0.2em] ma-text transition-colors hover:bg-[color:var(--ma-hair)]"
          >
            Applica
            {activeFilterCount > 0 && (
              <span className="ma-accent">({activeFilterCount})</span>
            )}
          </button>
        </footer>
      </aside>
    </div>
  )
}

function countActiveFilters(props: SourcesFilterRailProps) {
  const excluded = props.sources.reduce<number>(
    (acc, s: { sourceId: MangaSourceId }) =>
      acc + (props.enabledSources.has(s.sourceId) ? 0 : 1),
    0,
  )
  return (
    excluded +
    (props.langFilter ? 1 : 0) +
    (props.statusFilter ? 1 : 0) +
    (!props.hideNsfw ? 1 : 0)
  )
}
