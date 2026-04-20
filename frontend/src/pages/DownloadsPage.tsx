import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  HardDrive,
  Package,
  Pause,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { api } from '@/api/client'
import type {
  DownloadEvent,
  DownloadedChapterDto,
  DownloadQueueItemDto,
} from '@/api/sources'
import { Eyebrow, HeroTitle, SectionTitle } from '@/components/atelier'
import { ConfirmDialog, useConfirm } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'
import { AutoDownloaderRail } from '@/components/downloads/AutoDownloaderRail'
import { DownloadsHeroStats } from '@/components/downloads/DownloadsHeroStats'
import { QueueFilterTabs, type QueueFilter } from '@/components/downloads/QueueFilterTabs'
import { QueueRow } from '@/components/downloads/QueueRow'

export function DownloadsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { confirm, dialogProps } = useConfirm()
  const [filter, setFilter] = useState<QueueFilter>('all')

  useDownloadSSE()

  const statusQuery = useQuery({
    queryKey: ['download-status'],
    queryFn: api.getDownloadStatus,
    refetchInterval: 5000,
  })

  const queueQuery = useQuery({
    queryKey: ['download-queue'],
    queryFn: api.getDownloadQueue,
    refetchInterval: 3000,
  })

  const historyQuery = useQuery({
    queryKey: ['download-history'],
    queryFn: () => api.getDownloadHistory(100, 0),
  })

  const statsQuery = useQuery({
    queryKey: ['download-stats'],
    queryFn: api.getDownloadStats,
  })

  const invalidateQueue = () => {
    queryClient.invalidateQueries({ queryKey: ['download-queue'] })
    queryClient.invalidateQueries({ queryKey: ['download-status'] })
  }

  // Global mutations
  const retryFailedMutation = useMutation({
    mutationFn: api.retryFailedDownloads,
    onSuccess: () => {
      toast('Retry avviato sui falliti', 'success')
      invalidateQueue()
    },
  })
  const clearCompletedMutation = useMutation({
    mutationFn: api.clearCompletedDownloads,
    onSuccess: () => {
      toast('Completati puliti', 'success')
      invalidateQueue()
    },
  })
  const clearErrorsMutation = useMutation({
    mutationFn: api.clearErroredDownloads,
    onSuccess: () => {
      toast('Errori puliti', 'success')
      invalidateQueue()
    },
  })
  const pauseQueueMutation = useMutation({
    mutationFn: api.pauseDownloads,
    onSuccess: () => {
      toast('Coda in pausa', 'success')
      invalidateQueue()
    },
  })
  const resumeQueueMutation = useMutation({
    mutationFn: api.resumeDownloads,
    onSuccess: () => {
      toast('Coda ripresa', 'success')
      invalidateQueue()
    },
  })
  const cancelAllMutation = useMutation({
    mutationFn: api.cancelAllDownloads,
    onSuccess: () => {
      toast('Coda svuotata', 'success')
      invalidateQueue()
    },
  })

  // Per-item mutations
  const pauseItemMutation = useMutation({
    mutationFn: api.pauseDownloadItem,
    onSuccess: invalidateQueue,
  })
  const resumeItemMutation = useMutation({
    mutationFn: api.resumeDownloadItem,
    onSuccess: invalidateQueue,
  })
  const cancelItemMutation = useMutation({
    mutationFn: api.cancelDownloadItem,
    onSuccess: invalidateQueue,
  })
  const retryItemMutation = useMutation({
    mutationFn: api.retryDownloadItem,
    onSuccess: () => {
      invalidateQueue()
      queryClient.invalidateQueries({ queryKey: ['download-history'] })
    },
  })
  const moveItemMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'UP' | 'DOWN' }) =>
      api.moveDownloadItem(id, direction),
    onSuccess: invalidateQueue,
  })
  const removeItemMutation = useMutation({
    mutationFn: api.removeDownloadItem,
    onSuccess: invalidateQueue,
  })

  const status = statusQuery.data
  const queue = useMemo(() => queueQuery.data ?? [], [queueQuery.data])

  const counts = useMemo(() => {
    const active = queue.filter(
      (i) =>
        i.status === 'QUEUED' ||
        i.status === 'DOWNLOADING' ||
        i.status === 'PACKAGING' ||
        i.status === 'IMPORTING' ||
        i.status === 'PAUSED',
    )
    const completed = queue.filter((i) => i.status === 'COMPLETED')
    const errored = queue.filter((i) => i.status === 'ERROR')
    return {
      all: queue.length,
      active: active.length,
      completed: completed.length,
      errors: errored.length,
      activeItems: active,
      completedItems: completed,
      erroredItems: errored,
    }
  }, [queue])

  const filteredQueue = useMemo(() => {
    const sorted = [...queue].sort((a, b) => {
      const sa = statusRank(a.status)
      const sb = statusRank(b.status)
      if (sa !== sb) return sa - sb
      return (a.position ?? 0) - (b.position ?? 0)
    })
    switch (filter) {
      case 'active':
        return sorted.filter((i) =>
          ['QUEUED', 'DOWNLOADING', 'PACKAGING', 'IMPORTING', 'PAUSED'].includes(i.status),
        )
      case 'completed':
        return sorted.filter((i) => i.status === 'COMPLETED')
      case 'errors':
        return sorted.filter((i) => i.status === 'ERROR')
      case 'all':
      default:
        return sorted
    }
  }, [queue, filter])

  const queuedOrdered = useMemo(
    () => queue.filter((i) => i.status === 'QUEUED').sort((a, b) => a.position - b.position),
    [queue],
  )

  return (
    <div className="animate-page-in">
      <ConfirmDialog {...dialogProps} />

      <div className="mb-10 lg:mb-12">
        <Eyebrow jp="ダウンロード" en="Downloads" />
        <HeroTitle className="mt-4">Mission control.</HeroTitle>
        <p className="mt-4 max-w-xl font-sans text-[14px] leading-relaxed ma-muted">
          Coda, stato e automazione — tutto in un colpo d'occhio.
        </p>
      </div>

      <div className="grid gap-y-12 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-x-12">
        {/* MAIN column */}
        <div className="min-w-0">
          {status && (
            <DownloadsHeroStats
              activeCount={status.activeDownloads}
              queuedCount={status.queueSize}
              totalSpeedBps={status.totalSpeedBps}
              etaSec={status.totalEtaSec}
              completedToday={status.completedToday}
              failedCount={status.failedCount}
              paused={status.paused}
            />
          )}

          {/* Global controls */}
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 font-opsMono text-[11px] uppercase tracking-[0.2em]">
            {counts.activeItems.length > 0 && (
              status?.paused ? (
                <GlobalBtn
                  icon={<Play className="h-3 w-3" />}
                  onClick={() => resumeQueueMutation.mutate()}
                  tone="accent"
                >
                  riprendi coda
                </GlobalBtn>
              ) : (
                <GlobalBtn
                  icon={<Pause className="h-3 w-3" />}
                  onClick={() => pauseQueueMutation.mutate()}
                >
                  pausa coda
                </GlobalBtn>
              )
            )}
            {counts.erroredItems.length > 0 && (
              <GlobalBtn
                icon={<RotateCcw className="h-3 w-3" />}
                onClick={() => retryFailedMutation.mutate()}
              >
                retry falliti
              </GlobalBtn>
            )}
            {counts.activeItems.length > 0 && (
              <GlobalBtn
                icon={<Ban className="h-3 w-3" />}
                onClick={() =>
                  confirm(
                    `Cancellare tutti i ${counts.activeItems.filter((i) => i.status === 'QUEUED').length} download in coda?`,
                    () => cancelAllMutation.mutate(),
                  )
                }
              >
                cancella coda
              </GlobalBtn>
            )}
            {counts.completedItems.length > 0 && (
              <GlobalBtn
                icon={<Trash2 className="h-3 w-3" />}
                onClick={() =>
                  confirm(
                    `Pulire ${counts.completedItems.length} download completati dalla lista?`,
                    () => clearCompletedMutation.mutate(),
                  )
                }
              >
                pulisci completati
              </GlobalBtn>
            )}
            {counts.erroredItems.length > 0 && (
              <GlobalBtn
                icon={<Trash2 className="h-3 w-3" />}
                onClick={() =>
                  confirm(
                    `Pulire ${counts.erroredItems.length} download in errore?`,
                    () => clearErrorsMutation.mutate(),
                  )
                }
              >
                pulisci errori
              </GlobalBtn>
            )}
          </div>

          {/* Queue section */}
          <section className="mt-12">
            <SectionTitle title="Coda" jp="コエダ" />

            <div className="mb-4">
              <QueueFilterTabs
                value={filter}
                counts={{
                  all: counts.all,
                  active: counts.active,
                  completed: counts.completed,
                  errors: counts.errors,
                }}
                onChange={setFilter}
              />
            </div>

            {queueQuery.isLoading && (
              <div className="space-y-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            )}

            {queueQuery.isError && (
              <ErrorState
                message="Impossibile caricare la coda"
                onRetry={() => queueQuery.refetch()}
              />
            )}

            {queueQuery.isSuccess && filteredQueue.length === 0 && (
              <EmptyState
                title={filter === 'all' ? 'Coda vuota' : 'Nessun risultato'}
                description={
                  filter === 'all'
                    ? "Cerca un manga nella sezione Sources per iniziare a scaricare"
                    : 'Prova a cambiare filtro'
                }
              />
            )}

            {queueQuery.isSuccess && filteredQueue.length > 0 && (
              <div>
                {filteredQueue.map((item) => {
                  const idx = queuedOrdered.findIndex((q) => q.id === item.id)
                  const canMoveUp = idx > 0
                  const canMoveDown = idx >= 0 && idx < queuedOrdered.length - 1
                  return (
                    <QueueRow
                      key={item.id}
                      item={item}
                      canMoveUp={canMoveUp}
                      canMoveDown={canMoveDown}
                      onPause={() => pauseItemMutation.mutate(item.id)}
                      onResume={() => resumeItemMutation.mutate(item.id)}
                      onCancel={() =>
                        confirm(
                          `Cancellare il download di "${item.mangaTitle} ch.${item.chapterNumber}"?`,
                          () => cancelItemMutation.mutate(item.id),
                        )
                      }
                      onRetry={() => retryItemMutation.mutate(item.id)}
                      onMoveUp={() =>
                        moveItemMutation.mutate({ id: item.id, direction: 'UP' })
                      }
                      onMoveDown={() =>
                        moveItemMutation.mutate({ id: item.id, direction: 'DOWN' })
                      }
                      onRemove={() => removeItemMutation.mutate(item.id)}
                    />
                  )
                })}
              </div>
            )}
          </section>

          {/* History section */}
          <section className="mt-16">
            <SectionTitle
              title="Storia"
              jp="歴史"
              right={
                statsQuery.data ? (
                  <div className="flex items-center gap-5 font-opsMono text-[11px] uppercase tracking-[0.2em] ma-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Package className="h-3 w-3" />
                      {statsQuery.data.totalChapters}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <HardDrive className="h-3 w-3" />
                      {formatBytes(statsQuery.data.totalSizeBytes)}
                    </span>
                  </div>
                ) : undefined
              }
            />

            {historyQuery.isLoading && (
              <div className="space-y-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}
            {historyQuery.isError && (
              <ErrorState
                message="Impossibile caricare lo storico"
                onRetry={() => historyQuery.refetch()}
              />
            )}
            {historyQuery.isSuccess && historyQuery.data.length === 0 && (
              <EmptyState
                title="Nessun download"
                description="I capitoli completati appariranno qui"
              />
            )}
            {historyQuery.isSuccess && historyQuery.data.length > 0 && (
              <HistoryShelf items={historyQuery.data} />
            )}
          </section>
        </div>

        {/* RAIL column (desktop) / block (mobile) */}
        <div className="lg:block">
          <AutoDownloaderRail variant="rail" />
        </div>
      </div>
    </div>
  )
}

// ── History shelf (editorial, grouped by manga) ──

function HistoryShelf({ items }: { items: DownloadedChapterDto[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, DownloadedChapterDto[]>()
    for (const item of items) {
      const key = `${item.sourceId}::${item.mangaId}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return Array.from(map.entries()).map(([key, chapters]) => ({
      key,
      mangaTitle: chapters[0]!.mangaTitle,
      sourceId: chapters[0]!.sourceId,
      chapters: chapters.sort(
        (a, b) => (parseFloat(a.chapterNumber) || 0) - (parseFloat(b.chapterNumber) || 0),
      ),
    }))
  }, [items])

  return (
    <div>
      {grouped.map((group) => {
        const totalBytes = group.chapters.reduce((sum, ch) => sum + ch.fileSize, 0)
        return (
          <article key={group.key} className="border-b ma-hair py-5">
            <header className="flex items-baseline justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate font-serif italic text-[18px] leading-tight ma-text">
                  {group.mangaTitle}
                </h3>
                <p className="mt-0.5 font-opsMono text-[10px] uppercase tracking-[0.18em] ma-faint">
                  {group.sourceId.toLowerCase()} · {group.chapters.length} capitol
                  {group.chapters.length === 1 ? 'o' : 'i'}
                </p>
              </div>
              <span className="shrink-0 font-opsMono text-[11px] uppercase tracking-[0.2em] ma-muted">
                {formatBytes(totalBytes)}
              </span>
            </header>
            <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
              {group.chapters.map((ch) => (
                <div
                  key={ch.id}
                  className="flex items-baseline justify-between gap-3 py-1"
                >
                  <span className="truncate font-sans text-[13px] ma-text">
                    ch.{ch.chapterNumber}
                    {ch.volumeNumber && (
                      <span className="ma-faint"> · vol.{ch.volumeNumber}</span>
                    )}
                    {ch.language && (
                      <span className="ml-1.5 font-opsMono text-[10px] uppercase tracking-[0.14em] ma-faint">
                        {ch.language}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-opsMono text-[10px] uppercase tracking-[0.16em] ma-faint">
                    {formatBytes(ch.fileSize)} · {ch.pageCount}p
                  </span>
                </div>
              ))}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function GlobalBtn({
  icon,
  onClick,
  tone = 'default',
  children,
}: {
  icon: React.ReactNode
  onClick: () => void
  tone?: 'default' | 'accent'
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'inline-flex items-center gap-1.5 transition-colors ' +
        (tone === 'accent'
          ? 'ma-accent hover:opacity-80'
          : 'ma-muted hover:ma-text')
      }
    >
      {icon}
      <span>{children}</span>
    </button>
  )
}

// ── SSE hook with in-cache live updates ──

function useDownloadSSE() {
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const es = new EventSource('/api/downloads/events')
    eventSourceRef.current = es

    const applyLiveUpdate = (raw: MessageEvent) => {
      let evt: DownloadEvent | null = null
      try {
        evt = JSON.parse(raw.data) as DownloadEvent
      } catch {
        return
      }
      if (!evt || evt.type !== 'PageDownloadedEvent') return
      const pageEvt = evt
      queryClient.setQueryData<DownloadQueueItemDto[] | undefined>(
        ['download-queue'],
        (old) => {
          if (!old) return old
          return old.map((item) =>
            item.id === pageEvt.itemId
              ? {
                  ...item,
                  status: 'DOWNLOADING',
                  progress: pageEvt.currentPage,
                  totalPages: pageEvt.totalPages,
                  bytesDownloaded: pageEvt.bytesDownloaded ?? item.bytesDownloaded,
                  speedBps: pageEvt.speedBps ?? item.speedBps,
                  etaSec: pageEvt.etaSec ?? item.etaSec,
                }
              : item,
          )
        },
      )
    }

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['download-queue'] })
      queryClient.invalidateQueries({ queryKey: ['download-status'] })
    }

    es.addEventListener('PageDownloadedEvent', applyLiveUpdate)

    es.addEventListener('QueuedEvent', invalidate)
    es.addEventListener('DownloadStartedEvent', invalidate)
    es.addEventListener('PackagingEvent', invalidate)
    es.addEventListener('ImportingEvent', invalidate)
    es.addEventListener('ErrorEvent', invalidate)
    es.addEventListener('ItemPausedEvent', invalidate)
    es.addEventListener('ItemResumedEvent', invalidate)
    es.addEventListener('ItemCancelledEvent', invalidate)
    es.addEventListener('ReorderEvent', invalidate)
    es.addEventListener('QueueProgressEvent', invalidate)

    es.addEventListener('CompletedEvent', () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['download-history'] })
      queryClient.invalidateQueries({ queryKey: ['download-stats'] })
    })

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [queryClient])
}

// ── Utils ──

function statusRank(status: DownloadQueueItemDto['status']): number {
  switch (status) {
    case 'DOWNLOADING':
    case 'PACKAGING':
    case 'IMPORTING':
      return 0
    case 'QUEUED':
      return 1
    case 'PAUSED':
      return 2
    case 'ERROR':
      return 3
    case 'COMPLETED':
      return 4
    default:
      return 5
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
