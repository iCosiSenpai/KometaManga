import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { DownloadQueueItemDto, DownloadedChapterDto, AutoDownloaderRuleDto, MangaSourceId, CreateAutoDownloaderRuleDto, UpdateAutoDownloaderRuleDto, MangaSearchResultDto } from '@/api/sources'
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
  RefreshCw,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Edit3,
  Check,
  Search,
  Repeat,
} from 'lucide-react'
import { clsx } from 'clsx'

type Tab = 'queue' | 'history' | 'auto-download'

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

  // Auto-downloader status
  const autoStatusQuery = useQuery({
    queryKey: ['auto-downloader-status'],
    queryFn: api.getAutoDownloaderStatus,
    refetchInterval: 30_000,
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
  const autoStatus = autoStatusQuery.data

  const activeItems = queue.filter((i) => i.status === 'QUEUED' || i.status === 'DOWNLOADING' || i.status === 'PACKAGING' || i.status === 'IMPORTING')
  const completedItems = queue.filter((i) => i.status === 'COMPLETED')
  const erroredItems = queue.filter((i) => i.status === 'ERROR')

  return (
    <div className="animate-page-in">
      <PageHeader
        title="Downloads"
        description="Manual queue, download history, and automatic chapter tracking"
      />

      {/* Status overview strip */}
      {status && (
        <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <TabButton active={tab === 'auto-download'} onClick={() => setTab('auto-download')}>
            <Repeat className="h-3 w-3" />
            Auto
            {autoStatus && autoStatus.activeRulesCount > 0 && (
              <span className="ml-1 rounded-full bg-emerald-600/20 px-1.5 py-0.5 text-[10px] text-emerald-400">
                {autoStatus.activeRulesCount}
              </span>
            )}
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

      {/* Auto-Download Tab */}
      {tab === 'auto-download' && (
        <AutoDownloadSection />
      )}
    </div>
  )
}

// ── Auto-Download Section (integrated from AutoDownloaderPage) ──

function AutoDownloadSection() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const statusQuery = useQuery({
    queryKey: ['auto-downloader-status'],
    queryFn: api.getAutoDownloaderStatus,
    refetchInterval: 30_000,
  })

  const rulesQuery = useQuery({
    queryKey: ['auto-downloader-rules'],
    queryFn: api.getAutoDownloaderRules,
  })

  const checkNowMutation = useMutation({
    mutationFn: api.autoDownloaderCheckNow,
    onSuccess: () => {
      toast('Check started', 'success')
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-status'] })
    },
    onError: (err: Error) => {
      toast(err.message || 'Check failed', 'error')
    },
  })

  const createMutation = useMutation({
    mutationFn: api.createAutoDownloaderRule,
    onSuccess: () => {
      toast('Rule created', 'success')
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-rules'] })
      setShowCreate(false)
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to create rule', 'error')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAutoDownloaderRuleDto }) =>
      api.updateAutoDownloaderRule(id, body),
    onSuccess: () => {
      toast('Rule updated', 'success')
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-rules'] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteAutoDownloaderRule,
    onSuccess: () => {
      toast('Rule deleted', 'success')
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-rules'] })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.updateAutoDownloaderRule(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-rules'] })
    },
  })

  const status = statusQuery.data
  const rules = rulesQuery.data ?? []

  return (
    <div className="space-y-4">
      {/* Status & actions bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-ink-800/40 bg-ink-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {status && (
            <>
              <div className="flex items-center gap-2">
                {status.enabled ? (
                  <Power className="h-4 w-4 text-emerald-400" />
                ) : (
                  <PowerOff className="h-4 w-4 text-red-400" />
                )}
                <span className={status.enabled ? 'font-medium text-emerald-400' : 'text-red-400'}>
                  {status.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <span className="hidden h-4 w-px bg-ink-800/60 sm:block" />
              <div className="flex items-center gap-1.5 text-ink-400">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">
                  Last: {status.lastCheck ? formatDate(status.lastCheck) : 'Never'}
                </span>
              </div>
              {status.nextCheck && (
                <div className="flex items-center gap-1.5 text-ink-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">Next: {formatDate(status.nextCheck)}</span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => checkNowMutation.mutate()}
            loading={checkNowMutation.isPending}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Check Now
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Rule
          </Button>
        </div>
      </div>

      {/* Create rule form */}
      {showCreate && (
        <CreateRuleForm
          onSubmit={(dto) => createMutation.mutate(dto)}
          onCancel={() => setShowCreate(false)}
          loading={createMutation.isPending}
        />
      )}

      {/* Rules list */}
      {rulesQuery.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {rulesQuery.isError && (
        <ErrorState
          message="Failed to load rules"
          onRetry={() => rulesQuery.refetch()}
        />
      )}

      {rulesQuery.isSuccess && rules.length === 0 && !showCreate && (
        <EmptyState
          icon={<Repeat className="h-6 w-6" />}
          title="No auto-download rules"
          description="Add a rule to automatically download new chapters when they're released"
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add Rule
            </Button>
          }
        />
      )}

      {rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={(enabled) =>
                toggleMutation.mutate({ id: rule.id, enabled })
              }
              onDelete={() => {
                if (confirm(`Delete rule "${rule.mangaTitle}"?`)) {
                  deleteMutation.mutate(rule.id)
                }
              }}
              onUpdate={(body) =>
                updateMutation.mutate({ id: rule.id, body })
              }
              isEditing={editingId === rule.id}
              onEditToggle={() =>
                setEditingId(editingId === rule.id ? null : rule.id)
              }
            />
          ))}
        </div>
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
    <div
      className={clsx(
        'flex items-center gap-3 rounded-xl border p-3.5 transition-all',
        active
          ? 'border-sky-800/30 bg-sky-950/10'
          : error
            ? 'border-red-800/30 bg-red-950/10'
            : 'border-ink-800/30 bg-ink-900/30',
      )}
    >
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
        <p className="text-[11px] text-ink-500">{label}</p>
      </div>
    </div>
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
        'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
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

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium text-ink-200">
            {item.mangaTitle}
          </span>
          <span className="shrink-0 font-mono text-xs text-ink-400">
            Ch. {item.chapterNumber}
          </span>
        </div>

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
          <p className="mt-1 text-xs text-amber-400">Packaging CBZ...</p>
        )}
        {item.status === 'IMPORTING' && (
          <p className="mt-1 text-xs text-sky-400">Importing to Komga...</p>
        )}

        {item.status === 'ERROR' && item.error && (
          <p className="mt-1 truncate text-xs text-red-400">{item.error}</p>
        )}
      </div>

      <span className="hidden shrink-0 rounded bg-ink-800/60 px-1.5 py-0.5 text-[10px] font-medium uppercase text-ink-500 sm:inline">
        {item.sourceId}
      </span>

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

// ── RuleCard ──

function RuleCard({
  rule,
  onToggle,
  onDelete,
  onUpdate,
  isEditing,
  onEditToggle,
}: {
  rule: AutoDownloaderRuleDto
  onToggle: (enabled: boolean) => void
  onDelete: () => void
  onUpdate: (body: UpdateAutoDownloaderRuleDto) => void
  isEditing: boolean
  onEditToggle: () => void
}) {
  const [editLang, setEditLang] = useState(rule.language ?? '')
  const [editScanlator, setEditScanlator] = useState(rule.scanlator ?? '')
  const [editLastChapter, setEditLastChapter] = useState(
    rule.lastChapterNumber?.toString() ?? '',
  )

  return (
    <div
      className={clsx(
        'rounded-xl border p-4 transition-all',
        rule.enabled
          ? 'border-ink-800/40 bg-ink-900/40'
          : 'border-ink-800/20 bg-ink-900/20 opacity-60',
      )}
    >
      <div className="flex items-start gap-4">
        <button
          onClick={() => onToggle(!rule.enabled)}
          className={clsx(
            'mt-0.5 shrink-0 rounded-full p-1.5 transition-colors',
            rule.enabled
              ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
              : 'bg-ink-800/40 text-ink-500 hover:bg-ink-800/60',
          )}
          title={rule.enabled ? 'Disable' : 'Enable'}
        >
          {rule.enabled ? (
            <Power className="h-3.5 w-3.5" />
          ) : (
            <PowerOff className="h-3.5 w-3.5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-ink-200">{rule.mangaTitle}</span>
            <span className="rounded bg-ink-800/60 px-1.5 py-0.5 text-[10px] font-medium uppercase text-ink-500">
              {rule.sourceId}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
            {rule.language && <span>Language: {rule.language.toUpperCase()}</span>}
            {rule.scanlator && <span>Scanlator: {rule.scanlator}</span>}
            {rule.lastChapterNumber != null && (
              <span>Last: Ch. {rule.lastChapterNumber}</span>
            )}
          </div>

          {isEditing && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="text"
                value={editLang}
                onChange={(e) => setEditLang(e.target.value)}
                placeholder="Language"
                className="w-20 rounded-lg border border-ink-800/50 bg-ink-900/50 px-2 py-1 text-xs text-ink-200 outline-none focus:border-accent-600/50"
              />
              <input
                type="text"
                value={editScanlator}
                onChange={(e) => setEditScanlator(e.target.value)}
                placeholder="Scanlator"
                className="w-32 rounded-lg border border-ink-800/50 bg-ink-900/50 px-2 py-1 text-xs text-ink-200 outline-none focus:border-accent-600/50"
              />
              <input
                type="number"
                value={editLastChapter}
                onChange={(e) => setEditLastChapter(e.target.value)}
                placeholder="Last Ch."
                step="0.1"
                className="w-20 rounded-lg border border-ink-800/50 bg-ink-900/50 px-2 py-1 text-xs text-ink-200 outline-none focus:border-accent-600/50"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  onUpdate({
                    language: editLang || null,
                    scanlator: editScanlator || null,
                    lastChapterNumber: editLastChapter
                      ? parseFloat(editLastChapter)
                      : null,
                  })
                }
              >
                <Check className="h-3 w-3" />
                Save
              </Button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            onClick={onEditToggle}
            className="rounded p-1.5 text-ink-500 transition-colors hover:bg-ink-800/50 hover:text-ink-300"
            title="Edit"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1.5 text-ink-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CreateRuleForm ──

function CreateRuleForm({
  onSubmit,
  onCancel,
  loading,
}: {
  onSubmit: (dto: CreateAutoDownloaderRuleDto) => void
  onCancel: () => void
  loading: boolean
}) {
  const [sourceId, setSourceId] = useState<MangaSourceId | ''>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedManga, setSelectedManga] = useState<MangaSearchResultDto | null>(null)
  const [language, setLanguage] = useState('')
  const [scanlator, setScanlator] = useState('')

  const sourcesQuery = useQuery({
    queryKey: ['manga-sources'],
    queryFn: api.getSources,
  })

  const searchResults = useQuery({
    queryKey: ['auto-dl-search', sourceId, searchTerm],
    queryFn: () => api.searchSource(sourceId as string, searchTerm, 10),
    enabled: !!sourceId && searchTerm.length >= 2,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim().length >= 2) setSearchTerm(searchQuery.trim())
  }

  const handleSubmit = () => {
    if (!sourceId || !selectedManga) return
    onSubmit({
      sourceId: sourceId as MangaSourceId,
      mangaId: selectedManga.id,
      mangaTitle: selectedManga.title,
      language: language || undefined,
      scanlator: scanlator || undefined,
    })
  }

  return (
    <Card className="border-accent-800/20">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-ink-100">New Auto-Download Rule</h3>
        <button onClick={onCancel} className="rounded p-1 text-ink-500 hover:text-ink-300">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-400">Source</label>
          <select
            value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value as MangaSourceId)
              setSelectedManga(null)
              setSearchTerm('')
              setSearchQuery('')
            }}
            className="w-full rounded-lg border border-ink-800/50 bg-ink-900/50 px-3 py-2 text-sm text-ink-200 outline-none focus:border-accent-600/50"
          >
            <option value="">Select source...</option>
            {(sourcesQuery.data ?? []).map((s) => (
              <option key={s.sourceId} value={s.sourceId}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {sourceId && !selectedManga && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Manga</label>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search manga..."
                className="flex-1 rounded-lg border border-ink-800/50 bg-ink-900/50 px-3 py-2 text-sm text-ink-200 placeholder-ink-500 outline-none focus:border-accent-600/50"
              />
              <Button type="submit" size="sm" disabled={searchQuery.trim().length < 2}>
                <Search className="h-3.5 w-3.5" />
              </Button>
            </form>

            {searchResults.data && searchResults.data.length > 0 && (
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-ink-800/50 bg-ink-900/50 p-1">
                {searchResults.data.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedManga(r)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink-300 transition-colors hover:bg-ink-800/50 hover:text-ink-100"
                  >
                    {r.coverUrl && (
                      <img
                        src={r.coverUrl}
                        alt=""
                        className="h-10 w-7 shrink-0 rounded object-cover"
                      />
                    )}
                    <span className="truncate">{r.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedManga && (
          <div className="flex items-center gap-3 rounded-lg border border-accent-800/30 bg-accent-950/10 px-3 py-2">
            {selectedManga.coverUrl && (
              <img
                src={selectedManga.coverUrl}
                alt=""
                className="h-10 w-7 shrink-0 rounded object-cover"
              />
            )}
            <span className="flex-1 truncate text-sm text-ink-200">
              {selectedManga.title}
            </span>
            <button
              onClick={() => {
                setSelectedManga(null)
                setSearchTerm('')
                setSearchQuery('')
              }}
              className="shrink-0 rounded p-1 text-ink-500 hover:text-ink-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-ink-400">
              Language (optional)
            </label>
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="e.g. en, it"
              className="w-full rounded-lg border border-ink-800/50 bg-ink-900/50 px-3 py-2 text-sm text-ink-200 placeholder-ink-500 outline-none focus:border-accent-600/50"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-ink-400">
              Scanlator (optional)
            </label>
            <input
              type="text"
              value={scanlator}
              onChange={(e) => setScanlator(e.target.value)}
              placeholder="Group name"
              className="w-full rounded-lg border border-ink-800/50 bg-ink-900/50 px-3 py-2 text-sm text-ink-200 placeholder-ink-500 outline-none focus:border-accent-600/50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!sourceId || !selectedManga}
            loading={loading}
          >
            Create Rule
          </Button>
        </div>
      </div>
    </Card>
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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
