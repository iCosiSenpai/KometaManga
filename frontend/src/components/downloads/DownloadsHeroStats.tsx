import { StatColumn } from '@/components/atelier'

export interface DownloadsHeroStatsProps {
  activeCount: number
  queuedCount: number
  totalSpeedBps: number
  etaSec: number | null
  completedToday: number
  failedCount: number
  paused: boolean
}

export function DownloadsHeroStats({
  activeCount,
  queuedCount,
  totalSpeedBps,
  etaSec,
  completedToday,
  failedCount,
  paused,
}: DownloadsHeroStatsProps) {
  const speedLabel = formatSpeed(totalSpeedBps)
  const etaLabel = etaSec != null && etaSec > 0 ? formatEta(etaSec) : '—'

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 sm:gap-x-10">
        <StatColumn label="Attivi" value={activeCount} accent={activeCount > 0 && !paused} />
        <StatColumn label="In coda" value={queuedCount} />
        <StatColumn
          label="Velocità"
          value={speedLabel.value}
          unit={speedLabel.unit}
          accent={totalSpeedBps > 0}
        />
        <StatColumn label="ETA" value={etaLabel} unit={etaSec ? 'min : sec' : undefined} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-opsMono text-[10px] uppercase tracking-[0.2em] ma-faint">
        {paused && (
          <span className="ma-warn">● in pausa</span>
        )}
        <span>
          <span className="ma-muted">Completati oggi</span>{' '}
          <span className="ma-text">{completedToday}</span>
        </span>
        <span>
          <span className="ma-muted">Falliti</span>{' '}
          <span className={failedCount > 0 ? 'ma-warn' : 'ma-text'}>{failedCount}</span>
        </span>
      </div>
    </div>
  )
}

function formatSpeed(bps: number): { value: string; unit: string } {
  if (bps <= 0) return { value: '0', unit: 'B/s' }
  const k = 1024
  if (bps < k) return { value: String(Math.round(bps)), unit: 'B/s' }
  if (bps < k * k) return { value: (bps / k).toFixed(1), unit: 'KB/s' }
  if (bps < k * k * k) return { value: (bps / (k * k)).toFixed(1), unit: 'MB/s' }
  return { value: (bps / (k * k * k)).toFixed(1), unit: 'GB/s' }
}

function formatEta(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  if (s < 3600) {
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  }
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}
