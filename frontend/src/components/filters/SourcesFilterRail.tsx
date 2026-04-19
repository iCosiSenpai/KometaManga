import { clsx } from 'clsx'
import { RefreshCw } from 'lucide-react'
import { Eyebrow } from '@/components/atelier'
import { Flag } from '@/components/Flag'
import { SourceIcon } from '@/components/SourceIcon'
import { SOURCE_BRAND, langLabel } from '@/lib/brand'
import type { HealthStatus, MangaSourceId, MangaStatus } from '@/api/sources'

const HEALTH_DOT: Record<HealthStatus, string> = {
  GREEN: 'ma-bg-ok',
  YELLOW: 'ma-bg-warn',
  RED: 'ma-bg-accent',
}

const HEALTH_NOTE: Record<HealthStatus, string> = {
  GREEN: 'Stabile',
  YELLOW: 'Lenta o degradata',
  RED: 'Non disponibile',
}

const STATUS_LABEL: Record<MangaStatus, string> = {
  ONGOING: 'In corso',
  COMPLETED: 'Completato',
  HIATUS: 'In pausa',
  CANCELLED: 'Cancellato',
  UNKNOWN: 'Ignoto',
}

export interface SourcesFilterRailProps {
  sources: Array<{ sourceId: MangaSourceId; languages: string[] }>
  enabledSources: Set<MangaSourceId>
  availableLanguages: string[]
  langFilter: string | null
  statusFilter: MangaStatus | null
  hideNsfw: boolean
  healthMap: Map<
    MangaSourceId,
    { status: HealthStatus; latencyMs: number | null; error: string | null }
  >
  resultCountBySource: Map<MangaSourceId, number>
  isSearching: boolean
  refreshHealthPending: boolean
  onToggleSource: (id: MangaSourceId) => void
  onEnableAll: () => void
  onEnableHealthy: () => void
  onRefreshHealth: () => void
  onSetLang: (code: string | null) => void
  onSetStatus: (status: MangaStatus | null) => void
  onSetHideNsfw: (value: boolean) => void
  className?: string
}

export function SourcesFilterRail(props: SourcesFilterRailProps) {
  const {
    sources,
    enabledSources,
    availableLanguages,
    langFilter,
    statusFilter,
    hideNsfw,
    healthMap,
    resultCountBySource,
    isSearching,
    refreshHealthPending,
    onToggleSource,
    onEnableAll,
    onEnableHealthy,
    onRefreshHealth,
    onSetLang,
    onSetStatus,
    onSetHideNsfw,
    className,
  } = props

  const sortedSources = [...sources].sort((l, r) =>
    SOURCE_BRAND[l.sourceId].label.localeCompare(SOURCE_BRAND[r.sourceId].label),
  )

  return (
    <div className={clsx('font-sans', className)}>
      <Eyebrow jp="フィルター" en="Filtri" />

      {/* Sorgenti */}
      <section className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="ma-rail-heading">Sorgenti</h3>
          <span className="font-opsMono text-[10px] uppercase tracking-[0.18em] ma-faint">
            {enabledSources.size}/{sources.length}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" onClick={onEnableAll} className="ma-microlink">
            Tutte
          </button>
          <button type="button" onClick={onEnableHealthy} className="ma-microlink">
            Sane
          </button>
          <button
            type="button"
            onClick={onRefreshHealth}
            disabled={refreshHealthPending}
            className="ma-microlink"
            title="Aggiorna stato"
          >
            <RefreshCw className={clsx('h-3 w-3', refreshHealthPending && 'animate-spin')} />
            Stato
          </button>
        </div>
        <ul className="mt-3 space-y-0.5">
          {sortedSources.map((source) => {
            const meta = SOURCE_BRAND[source.sourceId]
            const active = enabledSources.has(source.sourceId)
            const health = healthMap.get(source.sourceId)
            const dotClass = health ? HEALTH_DOT[health.status] : 'ma-bg-accent-soft'
            const count = resultCountBySource.get(source.sourceId) ?? 0
            return (
              <li key={source.sourceId}>
                <label
                  className="ma-rail-row"
                  aria-pressed={active}
                  title={health ? HEALTH_NOTE[health.status] : meta.label}
                >
                  <input
                    type="checkbox"
                    className="ma-check"
                    checked={active}
                    onChange={() => onToggleSource(source.sourceId)}
                  />
                  <SourceIcon sourceId={source.sourceId} size={14} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                  {isSearching && active && (
                    <span className="font-opsMono text-[10px] ma-faint">{count}</span>
                  )}
                  <span
                    className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)}
                    aria-hidden
                  />
                </label>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Lingua */}
      <section className="mt-6 border-t ma-hair pt-6">
        <h3 className="ma-rail-heading">Lingua</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onSetLang(null)}
            className={clsx('ma-chip', !langFilter && 'ma-chip-active')}
          >
            Tutte
          </button>
          {availableLanguages.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => onSetLang(langFilter === lang ? null : lang)}
              className={clsx('ma-chip', langFilter === lang && 'ma-chip-active')}
            >
              <Flag code={lang} />
              {langLabel(lang)}
            </button>
          ))}
        </div>
      </section>

      {/* Stato */}
      <section className="mt-6 border-t ma-hair pt-6">
        <h3 className="ma-rail-heading">Stato</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onSetStatus(null)}
            className={clsx('ma-chip', !statusFilter && 'ma-chip-active')}
          >
            Tutti
          </button>
          {(['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED'] as MangaStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSetStatus(statusFilter === s ? null : s)}
              className={clsx('ma-chip', statusFilter === s && 'ma-chip-active')}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </section>

      {/* Contenuto */}
      <section className="mt-6 border-t ma-hair pt-6">
        <h3 className="ma-rail-heading">Contenuto</h3>
        <label className="mt-3 flex cursor-pointer items-start gap-2 font-sans text-[13px] ma-text">
          <input
            type="checkbox"
            className="ma-check mt-0.5"
            checked={hideNsfw}
            onChange={(e) => onSetHideNsfw(e.target.checked)}
          />
          <span className="min-w-0">
            <span className="block">Nascondi NSFW</span>
            <span className="mt-0.5 block font-sans text-[11px] ma-faint">
              Erotica &amp; pornografico
            </span>
          </span>
        </label>
      </section>
    </div>
  )
}
