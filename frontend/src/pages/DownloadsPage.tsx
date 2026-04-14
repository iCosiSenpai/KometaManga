import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { DownloadQueueItemDto, DownloadedChapterDto } from '@/api/sources'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'
import {
  Download,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  HardDrive,
  Activity,
  Loader2,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'

type Tab = 'queue' | 'history'

export function DownloadsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('queue')

  // SSE for real-time updates
  useDownloadSSE()

  // Status
  const statusQuery = useQuery({
    queryKey: ['download-status'],
    queryFn: api.getDownloadStatus,
    refetchInterval: 5000,
  })

  // Queue
  const queueQuery = useQuery({
    queryKey: ['download-queue'],
    queryFn: api.getDownloadQueue,
    refetchInterval: 3000,
  })

  // History
  const historyQuery = useQuery({
    queryKey: ['download-history'],
    queryFn: () => api.getDownloadHistory(100, 0),
    enabled: tab === 'history',
  })

  // Stats
  const statsQuery = useQuery({
    queryKey: ['download-stats'],
    queryFn: api.getDownloadStats,
    enabled: tab === 'history',
  })

  // Mutations
  const retryMutation = useMutation({
    mutationFn: api.retryFailedDownloads,
    onSuccess: () => {
      toast('Retrying failed downloads', 'success')
      queryClient.invalidateQueries({ queryKey: ['download-queue'] })
    },
  })

  const clearCompletedMutation = useMutation({
    mutationFn: api.clearCompletedDownloads,
    onSuccess: () => {
      toast('Cleared completed downloads', 'success')
      queryClient.invalidateQueries({ queryKey: ['download-queue'] })
    },
  })

  const clearErrorsMutation = useMutation({
    mutationFn: api.clearErroredDownloads,
    onSuccess: () => {
      toast('Cleared errored downloads', 'success')
      queryClient.invalidateQueries({ queryKey: ['download-queue'] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: api.removeDownloadItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['download-queue'] })
    },
  })

  const status = statusQuery.data
  const queue = queueQuery.data ?? []

  const activeItems = queue.filter((i) => i.status === 'QUEUED' || i.status === 'DOWNLOADING' || i.status === 'PACKAGING' || i.status === 'IMPORTING')
  const completedItems = queue.filter((i) => i.status === 'COMPLETED')
  const erroredItems = queue.filter((i) => i.status === 'ERROR')

  return (
    <div className="animate-page-in">
      <PageHeader
        title="Downloads"
        description="Manage your manga download queue and history"
      />

      {/* Status cards */}
      {status && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatusCard
            label="In Queue"
            value={status.queueSize}
            icon={<Clock className="h-4 w-4 text-ink-400" />}
          />
          <StatusCard
            label="Active"
            value={status.activeDownloads}
            icon={<Activity className="h-4 w-4 text-sky-400" />}
            active={status.activeDownloads > 0}
          />
          <StatusCard
            label="Completed Today"
            value={status.completedToday}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          />
          <StatusCard
            label="Failed"
            value={status.failedCount}
            icon={<XCircle className="h-4 w-4 text-red-400" />}
            error={status.failedCount > 0}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex gap-1 rounded-xl bg-ink-900/50 p-1">
          <TabButton active={tab === 'queue'} onClick={() => setTab('queue')}>
            Queue
            {activeItems.length > 0 && (
              <span className="ml-1.5 rounded-full bg-accent-600/20 px-1.5 py-0.5 text-[10px] text-accent-400">
                {activeItems.length}
              </span>
            )}
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
            History
          </TabButton>
        </div>

        {/* Queue actions */}
        {tab === 'queue' && (
          <div className="flex gap-2">
            {erroredItems.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => retryMutation.mutate()}
                loading={retryMutation.isPending}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retry Failed
              </Button>
            )}
            {completedItems.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`Clear ${completedItems.length} completed download${completedItems.length !== 1 ? 's' : ''}?`)) {
                    clearCompletedMutation.mutate()
                  }
                }}
              >
                Clear Done
              </Button>
            )}
            {erroredItems.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`Clear ${erroredItems.length} errored download${erroredItems.length !== 1 ? 's' : ''}?`)) {
                    clearErrorsMutation.mutate()
                  }
                }}
              >
                Clear Errors
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Queue Tab */}
      {tab === 'queue' && (
        <>
          {queueQuery.isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          )}

          {queueQuery.isError && (
            <ErrorState
              message="Failed to load queue"
              onRetry={() => queueQuery.refetch()}
            />
          )}

          {queueQuery.isSuccess && queue.length === 0 && (
            <EmptyState
              icon={<Download className="h-6 w-6" />}
              title="Queue is empty"
              description="Search for manga in Sources to start downloading"
            />
          )}

          {queueQuery.isSuccess && queue.length > 0 && (
            <div className="space-y-1.5">
              {queue.map((item) => (
                <QueueItem
                  key={item.id}
                  item={item}
                  onRemove={() => removeMutation.mutate(item.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <>
          {/* Stats */}
          {statsQuery.data && (
            <div className="mb-4 flex gap-4 text-sm text-ink-400">
              <span className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                {statsQuery.data.totalChapters} chapters
              </span>
              <span className="flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5" />
                {formatBytes(statsQuery.data.totalSizeBytes)}
              </span>
            </div>
          )}

          {historyQuery.isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          )}

          {historyQuery.isError && (
            <ErrorState
              message="Failed to load history"
              onRetry={() => historyQuery.refetch()}
            />
          )}

          {historyQuery.isSuccess && historyQuery.data.length === 0 && (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="No downloads yet"
              description="Completed downloads will appear here"
            />
          )}

          {historyQuery.isSuccess && historyQuery.data.length > 0 && (
            <HistoryList items={historyQuery.data} />
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-components ──

function StatusCard({
  label,
  value,
  icon,
  active,
  error,
}: {
  label: string
  value: number
  icon: React.ReactNode
  active?: boolean
  error?: boolean
}) {
  return (
    <Card variant="subtle" className="flex items-center gap-3">
      <div
        className={clsx(
          'flex h-9 w-9 items-center justify-center rounded-lg',
          active ? 'bg-sky-500/10' : error ? 'bg-red-500/10' : 'bg-ink-800/40',
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-lg font-semibold text-ink-100">{value}</p>
        <p className="text-xs text-ink-500">{label}</p>
      </div>
    </Card>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
        active
          ? 'bg-ink-800 text-ink-100 shadow-sm'
          : 'text-ink-400 hover:text-ink-200',
      )}
    >
      {children}
    </button>
  )
}

function QueueItem({
  item,
  onRemove,
}: {
  item: DownloadQueueItemDto
  onRemove: () => void
}) {
  const isActive = item.status === 'DOWNLOADING' || item.status === 'PACKAGING' || item.status === 'IMPORTING'
  const progress =
    item.totalPages && item.progress
      ? Math.round((item.progress / item.totalPages) * 100)
      : 0

  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-xl border px-4 py-3 transition-all',
        item.status === 'ERROR'
          ? 'border-red-800/30 bg-red-950/10'
          : item.status === 'COMPLETED'
            ? 'border-emerald-800/30 bg-emerald-950/10'
            : isActive
              ? 'border-accent-800/30 bg-accent-950/10'
              : 'border-ink-800/40 bg-ink-900/40',
      )}
    >
      {/* Status icon */}
      <div className="shrink-0">
        {item.status === 'QUEUED' && <Clock className="h-4 w-4 text-ink-500" />}
        {item.status === 'DOWNLOADING' && (
          <Loader2 className="h-4 w-4 animate-spin text-accent-400" />
        )}
        {item.status === 'PACKAGING' && (
          <Package className="h-4 w-4 animate-pulse text-amber-400" />
        )}
        {item.status === 'IMPORTING' && (
          <HardDrive className="h-4 w-4 animate-pulse text-sky-400" />
        )}
        {item.status === 'COMPLETED' && (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        )}
        {item.status === 'ERROR' && <XCircle className="h-4 w-4 text-red-400" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium text-ink-200">
            {item.mangaTitle}
          </span>
          <span className="shrink-0 font-mono text-xs text-ink-400">
            Ch. {item.chapterNumber}
          </span>
        </div>

        {/* Progress bar for active downloads */}
        {item.status === 'DOWNLOADING' && item.totalPages && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800/50">
              <div
                className="h-full rounded-full bg-accent-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] text-ink-500">
              {item.progress}/{item.totalPages}
            </span>
          </div>
        )}

        {item.status === 'PACKAGING' && (
          <p className="mt-1 text-xs text-amber-400">Packaging CBZ…</p>
        )}
        {item.status === 'IMPORTING' && (
          <p className="mt-1 text-xs text-sky-400">Importing to Komga…</p>
        )}

        {/* Error message */}
        {item.status === 'ERROR' && item.error && (
          <p className="mt-1 truncate text-xs text-red-400">{item.error}</p>
        )}
      </div>

      {/* Source badge */}
      <span className="hidden shrink-0 rounded bg-ink-800/60 px-1.5 py-0.5 text-[10px] font-medium uppercase text-ink-500 sm:inline">
        {item.sourceId}
      </span>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="shrink-0 rounded p-1 text-ink-500 transition-colors hover:bg-ink-800/50 hover:text-ink-300"
        title="Remove"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function HistoryList({ items }: { items: DownloadedChapterDto[] }) {
  // Group by manga
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
    <div className="space-y-4">
      {grouped.map((group) => (
        <Card key={group.key} variant="subtle">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink-200">{group.mangaTitle}</h3>
              <span className="text-xs text-ink-500">{group.sourceId} · {group.chapters.length} chapters</span>
            </div>
            <span className="text-xs text-ink-500">
              {formatBytes(group.chapters.reduce((sum, ch) => sum + ch.fileSize, 0))}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {group.chapters.map((ch) => (
              <div
                key={ch.id}
                className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs hover:bg-ink-800/30"
              >
                <span className="text-ink-300">
                  Ch. {ch.chapterNumber}
                  {ch.volumeNumber && ` · Vol. ${ch.volumeNumber}`}
                  {ch.language && (
                    <span className="ml-1.5 uppercase text-ink-500">{ch.language}</span>
                  )}
                </span>
                <span className="text-ink-500">
                  {formatBytes(ch.fileSize)} · {ch.pageCount}p
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── Hooks ──

function useDownloadSSE() {
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const es = new EventSource('/api/downloads/events')
    eventSourceRef.current = es

    es.onmessage = () => {
      // Invalidate queue on any event
      queryClient.invalidateQueries({ queryKey: ['download-queue'] })
      queryClient.invalidateQueries({ queryKey: ['download-status'] })
    }

    es.addEventListener('CompletedEvent', () => {
      queryClient.invalidateQueries({ queryKey: ['download-history'] })
      queryClient.invalidateQueries({ queryKey: ['download-stats'] })
    })

    es.onerror = () => {
      // Reconnect handled by EventSource automatically
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [queryClient])
}

// ── Utils ──

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
