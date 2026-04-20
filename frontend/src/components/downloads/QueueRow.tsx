import { clsx } from 'clsx'
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  HardDrive,
  Loader2,
  Package,
  Pause,
  Play,
  RotateCcw,
  XCircle,
  X,
} from 'lucide-react'
import type { DownloadQueueItemDto } from '@/api/sources'

export interface QueueRowProps {
  item: DownloadQueueItemDto
  canMoveUp: boolean
  canMoveDown: boolean
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onRetry: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}

export function QueueRow({
  item,
  canMoveUp,
  canMoveDown,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onMoveUp,
  onMoveDown,
  onRemove,
}: QueueRowProps) {
  const isActive =
    item.status === 'DOWNLOADING' ||
    item.status === 'PACKAGING' ||
    item.status === 'IMPORTING'

  const progressPct =
    item.totalPages && item.progress != null && item.totalPages > 0
      ? Math.min(100, Math.round((item.progress / item.totalPages) * 100))
      : 0

  return (
    <div className="border-b ma-hair">
      <div className="flex items-center gap-4 py-3.5">
        <StatusGlyph status={item.status} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-serif italic text-[15px] leading-tight ma-text">
              {item.mangaTitle}
            </span>
            <span className="shrink-0 font-opsMono text-[11px] uppercase tracking-[0.18em] ma-muted">
              ch.{item.chapterNumber}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-opsMono text-[10px] uppercase tracking-[0.16em] ma-faint">
            <span>{item.sourceId.toLowerCase()}</span>
            <span aria-hidden>→</span>
            <span className="truncate">{item.libraryPath || 'libreria predefinita'}</span>
            {item.position > 0 && (item.status === 'QUEUED' || item.status === 'PAUSED') && (
              <span>· #{item.position}</span>
            )}
          </div>

          {isActive && item.totalPages != null && (
            <div className="mt-2.5">
              <div className="h-px w-full bg-[var(--ma-hair)]">
                <div
                  className="h-px bg-[var(--ma-accent)] transition-[width] duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 font-opsMono text-[10px] uppercase tracking-[0.18em] ma-muted">
                <span>
                  <span className="ma-text">{item.progress ?? 0}</span>
                  <span className="ma-faint">/{item.totalPages}</span>
                </span>
                <span>· {progressPct}%</span>
                {item.speedBps != null && item.speedBps > 0 && (
                  <span className="ma-accent">{formatSpeed(item.speedBps)}</span>
                )}
                {item.etaSec != null && item.etaSec > 0 && (
                  <span>· ETA {formatEta(item.etaSec)}</span>
                )}
                {item.bytesDownloaded != null && item.bytesDownloaded > 0 && (
                  <span className="ma-faint">· {formatBytes(item.bytesDownloaded)}</span>
                )}
              </div>
            </div>
          )}

          {item.status === 'PACKAGING' && (
            <p className="mt-1 font-opsMono text-[10px] uppercase tracking-[0.18em] ma-warn">
              pacchettizzando cbz
            </p>
          )}
          {item.status === 'IMPORTING' && (
            <p className="mt-1 font-opsMono text-[10px] uppercase tracking-[0.18em] ma-accent">
              importando in komga
            </p>
          )}

          {item.status === 'ERROR' && item.error && (
            <p className="mt-1.5 truncate font-sans text-[12px] leading-snug ma-warn">
              {item.error}
            </p>
          )}

          {item.status === 'PAUSED' && (
            <p className="mt-1 font-opsMono text-[10px] uppercase tracking-[0.18em] ma-warn">
              in pausa
            </p>
          )}
        </div>

        <ActionCluster
          status={item.status}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          onRetry={onRetry}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onRemove={onRemove}
        />
      </div>
    </div>
  )
}

function StatusGlyph({ status }: { status: DownloadQueueItemDto['status'] }) {
  const common = 'h-4 w-4 shrink-0'
  switch (status) {
    case 'QUEUED':
      return <Clock aria-label="in coda" className={clsx(common, 'ma-faint')} />
    case 'DOWNLOADING':
      return <Loader2 aria-label="in download" className={clsx(common, 'animate-spin ma-accent')} />
    case 'PACKAGING':
      return <Package aria-label="pacchettizzando" className={clsx(common, 'animate-pulse ma-warn')} />
    case 'IMPORTING':
      return <HardDrive aria-label="importando" className={clsx(common, 'animate-pulse ma-accent')} />
    case 'COMPLETED':
      return <CheckCircle2 aria-label="completato" className={clsx(common, 'ma-ok')} />
    case 'ERROR':
      return <XCircle aria-label="errore" className={clsx(common, 'ma-warn')} />
    case 'PAUSED':
      return <Pause aria-label="in pausa" className={clsx(common, 'ma-muted')} />
    default:
      return null
  }
}

function ActionCluster({
  status,
  canMoveUp,
  canMoveDown,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onMoveUp,
  onMoveDown,
  onRemove,
}: Pick<
  QueueRowProps,
  | 'canMoveUp'
  | 'canMoveDown'
  | 'onPause'
  | 'onResume'
  | 'onCancel'
  | 'onRetry'
  | 'onMoveUp'
  | 'onMoveDown'
  | 'onRemove'
> & { status: DownloadQueueItemDto['status'] }) {
  if (status === 'COMPLETED') {
    return (
      <div className="flex shrink-0 gap-0.5">
        <IconBtn label="rimuovi dalla lista" onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
    )
  }

  if (status === 'ERROR') {
    return (
      <div className="flex shrink-0 gap-0.5">
        <IconBtn label="riprova" onClick={onRetry}>
          <RotateCcw className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label="rimuovi" onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
    )
  }

  if (status === 'PAUSED') {
    return (
      <div className="flex shrink-0 gap-0.5">
        <IconBtn label="riprendi" onClick={onResume}>
          <Play className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label="rimuovi" onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
    )
  }

  if (status === 'QUEUED') {
    return (
      <div className="flex shrink-0 gap-0.5">
        <IconBtn label="sposta su" onClick={onMoveUp} disabled={!canMoveUp}>
          <ChevronUp className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label="sposta giù" onClick={onMoveDown} disabled={!canMoveDown}>
          <ChevronDown className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label="pausa" onClick={onPause}>
          <Pause className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label="rimuovi" onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
    )
  }

  // DOWNLOADING / PACKAGING / IMPORTING
  return (
    <div className="flex shrink-0 gap-0.5">
      <IconBtn label="pausa" onClick={onPause} disabled={status !== 'DOWNLOADING'}>
        <Pause className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="cancella" onClick={onCancel}>
        <Ban className="h-3.5 w-3.5" />
      </IconBtn>
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex h-8 w-8 items-center justify-center rounded-sm ma-muted transition-colors',
        'hover:bg-[var(--ma-surface)] hover:ma-text',
        'disabled:pointer-events-none disabled:opacity-30',
      )}
    >
      {children}
    </button>
  )
}

function formatSpeed(bps: number): string {
  if (bps <= 0) return '0 B/s'
  const k = 1024
  if (bps < k) return `${Math.round(bps)} B/s`
  if (bps < k * k) return `${(bps / k).toFixed(1)} KB/s`
  if (bps < k * k * k) return `${(bps / (k * k)).toFixed(1)} MB/s`
  return `${(bps / (k * k * k)).toFixed(1)} GB/s`
}

function formatEta(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  if (s < 60) return `${s}s`
  if (s < 3600) {
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${String(r).padStart(2, '0')}`
  }
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h${String(m).padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
