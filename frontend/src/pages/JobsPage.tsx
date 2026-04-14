import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/Button'
import { api, type MetadataJob, type JobStatus } from '@/api/client'
import { Link } from 'react-router-dom'
import {
  Activity,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
  Clock,
  RotateCcw,
  ExternalLink,
} from 'lucide-react'
import { clsx } from 'clsx'

const PAGE_SIZE = 20

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

type FilterStatus = 'ALL' | JobStatus

export function JobsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<FilterStatus>('ALL')
  const [page, setPage] = useState(1)
  const [detailJob, setDetailJob] = useState<MetadataJob | null>(null)

  // Reset page when filter changes
  useEffect(() => setPage(1), [filter])

  const { data, isLoading, error } = useQuery({
    queryKey: ['jobs', filter, page],
    queryFn: () =>
      api.getJobs({
        status: filter === 'ALL' ? undefined : filter,
        page,
        pageSize: PAGE_SIZE,
      }),
    refetchInterval: (query) => {
      const jobs = query.state.data?.content
      if (jobs?.some((j) => j.status === 'RUNNING')) return 3000
      return 15000
    },
  })

  const deleteAll = useMutation({
    mutationFn: () => api.deleteAllJobs(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  })

  const jobs = data?.content ?? []
  const totalPages = data?.totalPages ?? 0
  const nameMap = useSeriesNameMap(jobs)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Jobs"
        description="Metadata processing job history and live progress."
      />

      {/* Filters + Actions */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {(['ALL', 'RUNNING', 'COMPLETED', 'FAILED'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                filter === s
                  ? 'bg-accent-600 text-white'
                  : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200',
              )}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm('Delete all job history?')) deleteAll.mutate()
          }}
          disabled={deleteAll.isPending || jobs.length === 0}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete All
        </Button>
      </div>

      {/* Job Detail Modal */}
      {detailJob && (
        <JobDetailModal job={detailJob} onClose={() => setDetailJob(null)} seriesName={nameMap.get(detailJob.seriesId)} />
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-ink-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-900/30 bg-red-950/20 p-4 text-sm text-red-400">
          Failed to load jobs: {(error as Error).message}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-10 w-10" />}
          title="No jobs"
          description={
            filter === 'ALL'
              ? 'No metadata jobs recorded yet.'
              : `No ${filter.toLowerCase()} jobs.`
          }
        />
      ) : (
        <>
          <div className="space-y-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} onClick={() => setDetailJob(job)} seriesName={nameMap.get(job.seriesId)} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-ink-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Job Card
// ---------------------------------------------------------------------------

/** Resolve seriesId → human-readable name via Komga libraries API */
function useSeriesNameMap(_jobs: MetadataJob[]) {
  const librariesQuery = useQuery({
    queryKey: ['libraries'],
    queryFn: api.getLibraries,
    staleTime: 60_000 * 5,
  })
  const libraries = librariesQuery.data ?? []

  // Fetch all series from all libraries (cached)
  const allSeriesQuery = useQuery({
    queryKey: ['all-series-for-jobs', libraries.map((l) => l.id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        libraries.map((lib) => api.getLibrarySeries(lib.id))
      )
      return results.flat()
    },
    enabled: libraries.length > 0,
    staleTime: 60_000 * 5,
  })

  const nameMap = new Map<string, string>()
  for (const s of allSeriesQuery.data ?? []) {
    nameMap.set(s.id, s.name)
  }
  return nameMap
}

function JobCard({ job, onClick, seriesName }: { job: MetadataJob; onClick: () => void; seriesName?: string }) {
  return (
    <Card className="!p-4 cursor-pointer transition-colors hover:bg-ink-800/20" onClick={onClick}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Status + Series Name */}
          <div className="flex items-center gap-2">
            <JobStatusIcon status={job.status} />
            <span
              className={clsx(
                'text-sm font-semibold',
                job.status === 'RUNNING' && 'text-amber-400',
                job.status === 'COMPLETED' && 'text-emerald-400',
                job.status === 'FAILED' && 'text-red-400',
              )}
            >
              {job.status}
            </span>
            <span
              className="max-w-[20rem] truncate text-sm text-ink-200"
              title={seriesName || job.seriesId}
            >
              <Link
                to={`/komga?path=${encodeURIComponent(`/series/${job.seriesId}`)}`}
                className="inline-flex items-center gap-1 hover:text-accent-400 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {seriesName || job.seriesId.slice(0, 12) + '…'}
                <ExternalLink className="h-3 w-3 opacity-50" />
              </Link>
            </span>
          </div>

          {/* Error message */}
          {job.message && (
            <p className="mt-1.5 whitespace-pre-line text-sm text-red-400/80">{job.message}</p>
          )}

          {/* Live progress for running jobs */}
          {job.status === 'RUNNING' && <RunningJobProgress jobId={job.id} />}

          {/* Timestamps */}
          <div className="mt-2 flex items-center gap-3 text-xs text-ink-600">
            <span title={job.startedAt}>Started {relativeTime(job.startedAt)}</span>
            {job.finishedAt && (
              <span title={job.finishedAt}>· Finished {relativeTime(job.finishedAt)}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

function JobStatusIcon({ status }: { status: JobStatus }) {
  switch (status) {
    case 'RUNNING':
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
    case 'COMPLETED':
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
    case 'FAILED':
      return <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
  }
}

// ---------------------------------------------------------------------------
// Live progress for a single running job (SSE)
// ---------------------------------------------------------------------------

interface JobProgressEvent {
  phase: 'series' | 'book' | 'completed' | 'error' | 'post-processing' | 'not-found'
  provider?: string
  totalBooks?: number
  bookProgress?: number
  message?: string
}

function RunningJobProgress({ jobId }: { jobId: string }) {
  const [events, setEvents] = useState<JobProgressEvent[]>([])
  const esRef = useRef<EventSource | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    const es = api.getJobEvents(jobId)
    esRef.current = es

    const push = (evt: JobProgressEvent) =>
      setEvents((prev) => [...prev.slice(-20), evt])

    const listen = (name: string, handler: (data: unknown) => void) => {
      es.addEventListener(name, ((e: Event) => {
        const me = e as MessageEvent
        handler(me.data ? JSON.parse(me.data) : undefined)
      }) as EventListener)
    }

    listen('ProviderSeriesEvent', (d: unknown) => {
      const { provider } = d as { provider: string }
      push({ phase: 'series', provider })
    })
    listen('ProviderBookEvent', (d: unknown) => {
      const { provider, totalBooks, bookProgress } = d as {
        provider: string
        totalBooks: number
        bookProgress: number
      }
      push({ phase: 'book', provider, totalBooks, bookProgress })
    })
    listen('ProviderCompletedEvent', (d: unknown) => {
      const { provider } = d as { provider: string }
      push({ phase: 'completed', provider })
    })
    listen('ProviderErrorEvent', (d: unknown) => {
      const { provider, message } = d as { provider: string; message: string }
      push({ phase: 'error', provider, message })
    })
    listen('PostProcessingStartEvent', () => {
      push({ phase: 'post-processing' })
    })
    listen('ProcessingErrorEvent', (d: unknown) => {
      const { message } = d as { message: string }
      push({ phase: 'error', message })
    })
    listen('EventStreamNotFoundEvent', () => {
      push({ phase: 'not-found' })
      es.close()
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    })

    es.onerror = () => {
      es.close()
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    }

    return () => es.close()
  }, [jobId, queryClient])

  if (events.length === 0) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-ink-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Connecting to event stream…</span>
      </div>
    )
  }

  const latest = events[events.length - 1]
  if (!latest) return null

  return (
    <div className="mt-2 space-y-1">
      {/* Current status */}
      <div className="flex items-center gap-2 text-xs text-ink-400">
        {latest.phase === 'series' && (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-accent-400" />
            <span>
              Fetching series metadata from{' '}
              <span className="text-ink-200">{latest.provider}</span>
            </span>
          </>
        )}
        {latest.phase === 'book' && (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-accent-400" />
            <span>
              Book {latest.bookProgress}/{latest.totalBooks} ({latest.provider})
            </span>
          </>
        )}
        {latest.phase === 'completed' && (
          <span className="text-emerald-400">✓ {latest.provider} completed</span>
        )}
        {latest.phase === 'post-processing' && (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-accent-400" />
            <span>Post-processing metadata…</span>
          </>
        )}
        {latest.phase === 'error' && (
          <span className="text-red-400">Error: {latest.message}</span>
        )}
      </div>

      {/* Book progress bar */}
      {latest.phase === 'book' && latest.totalBooks != null && latest.bookProgress != null && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-accent-500 transition-all duration-300"
              style={{
                width: `${Math.round((latest.bookProgress / latest.totalBooks) * 100)}%`,
              }}
            />
          </div>
          <span className="text-xs text-ink-500">
            {Math.round((latest.bookProgress / latest.totalBooks) * 100)}%
          </span>
        </div>
      )}

      {/* Event log */}
      {events.length > 1 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-ink-600 hover:text-ink-400">
            Event log ({events.length})
          </summary>
          <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto rounded bg-ink-900/50 p-2 font-mono text-xs text-ink-500">
            {events.map((evt, i) => (
              <div key={i}>
                {evt.phase === 'series' && `▶ ${evt.provider}: fetching series`}
                {evt.phase === 'book' &&
                  `▶ ${evt.provider}: book ${evt.bookProgress}/${evt.totalBooks}`}
                {evt.phase === 'completed' && `✓ ${evt.provider}: completed`}
                {evt.phase === 'error' && `✗ error: ${evt.message}`}
                {evt.phase === 'post-processing' && `▶ post-processing`}
                {evt.phase === 'not-found' && `— stream ended`}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Job Detail Modal — full event timeline + metadata
// ---------------------------------------------------------------------------

function JobDetailModal({ job, onClose, seriesName }: { job: MetadataJob; onClose: () => void; seriesName?: string }) {
  const [events, setEvents] = useState<JobProgressEvent[]>([])
  const esRef = useRef<EventSource | null>(null)
  const queryClient = useQueryClient()
  const cancelMutation = useMutation({
    mutationFn: () => api.cancelJob(job.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      onClose()
    },
  })
  const retryMutation = useMutation({
    mutationFn: () => api.retryJob(job.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      onClose()
    },
  })

  useEffect(() => {
    if (job.status !== 'RUNNING') return
    const es = api.getJobEvents(job.id)
    esRef.current = es

    const push = (evt: JobProgressEvent) =>
      setEvents((prev) => [...prev, evt])

    const listen = (name: string, handler: (data: unknown) => void) => {
      es.addEventListener(name, ((e: Event) => {
        const me = e as MessageEvent
        handler(me.data ? JSON.parse(me.data) : undefined)
      }) as EventListener)
    }

    listen('ProviderSeriesEvent', (d: unknown) => {
      const { provider } = d as { provider: string }
      push({ phase: 'series', provider })
    })
    listen('ProviderBookEvent', (d: unknown) => {
      const { provider, totalBooks, bookProgress } = d as {
        provider: string; totalBooks: number; bookProgress: number
      }
      push({ phase: 'book', provider, totalBooks, bookProgress })
    })
    listen('ProviderCompletedEvent', (d: unknown) => {
      const { provider } = d as { provider: string }
      push({ phase: 'completed', provider })
    })
    listen('ProviderErrorEvent', (d: unknown) => {
      const { provider, message } = d as { provider: string; message: string }
      push({ phase: 'error', provider, message })
    })
    listen('PostProcessingStartEvent', () => push({ phase: 'post-processing' }))
    listen('ProcessingErrorEvent', (d: unknown) => {
      const { message } = d as { message: string }
      push({ phase: 'error', message })
    })
    listen('EventStreamNotFoundEvent', () => {
      push({ phase: 'not-found' })
      es.close()
    })
    es.onerror = () => es.close()

    return () => es.close()
  }, [job.id, job.status])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const statusColor = {
    RUNNING: 'text-amber-400',
    COMPLETED: 'text-emerald-400',
    FAILED: 'text-red-400',
  }[job.status]

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[10vh] backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-ink-800/60 bg-ink-950 shadow-2xl" role="dialog" aria-modal="true" aria-label="Job details">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-800/50 px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold text-ink-100">Job Details</h2>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
              <JobStatusIcon status={job.status} />
              <span className={statusColor}>{job.status}</span>
              <span className="font-mono">{job.id.slice(0, 8)}</span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {/* Job info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-ink-500">Series</span>
              <p className="truncate text-xs font-medium text-ink-200" title={seriesName || job.seriesId}>{seriesName || job.seriesId}</p>
            </div>
            <div>
              <span className="text-xs text-ink-500">Started</span>
              <p className="text-xs text-ink-300">{new Date(job.startedAt).toLocaleString()}</p>
            </div>
            {job.finishedAt && (
              <>
                <div>
                  <span className="text-xs text-ink-500">Finished</span>
                  <p className="text-xs text-ink-300">{new Date(job.finishedAt).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-xs text-ink-500">Duration</span>
                  <p className="text-xs text-ink-300">
                    {formatDuration(new Date(job.startedAt), new Date(job.finishedAt))}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Error message */}
          {job.message && (
            <div className="rounded-lg border border-red-900/30 bg-red-950/20 p-3">
              <p className="text-xs font-medium text-red-400">Error</p>
              <p className="mt-1 whitespace-pre-line text-sm text-red-400/80">{job.message}</p>
            </div>
          )}

          {/* Event timeline (for running jobs via SSE, or static for completed) */}
          {job.status === 'RUNNING' && events.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-400">
                <Clock className="h-3 w-3" /> Live Event Timeline
              </h3>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-ink-900/50 p-3 font-mono text-xs text-ink-400">
                {events.map((evt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="shrink-0 text-ink-600">{String(i + 1).padStart(2, '0')}</span>
                    {evt.phase === 'series' && <span>▶ <span className="text-accent-400">{evt.provider}</span>: fetching series</span>}
                    {evt.phase === 'book' && <span>▶ <span className="text-accent-400">{evt.provider}</span>: book {evt.bookProgress}/{evt.totalBooks}</span>}
                    {evt.phase === 'completed' && <span className="text-emerald-400">✓ {evt.provider}: completed</span>}
                    {evt.phase === 'error' && <span className="text-red-400">✗ {evt.message}</span>}
                    {evt.phase === 'post-processing' && <span className="text-violet-400">▶ post-processing</span>}
                    {evt.phase === 'not-found' && <span className="text-ink-500">— stream ended</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {job.status === 'RUNNING' && events.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Connecting to event stream…</span>
            </div>
          )}

          {/* Cancel button for running jobs */}
          {job.status === 'RUNNING' && (
            <div className="pt-2 border-t border-ink-800/40">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('Cancel this job?')) cancelMutation.mutate()
                }}
                loading={cancelMutation.isPending}
                className="text-red-400 hover:text-red-300"
              >
                <X className="h-3.5 w-3.5" />
                Cancel Job
              </Button>
            </div>
          )}

          {/* Retry button for failed/completed jobs */}
          {(job.status === 'FAILED' || job.status === 'COMPLETED') && (
            <div className="pt-2 border-t border-ink-800/40">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('Retry this job? A new metadata match will be launched for this series.')) retryMutation.mutate()
                }}
                loading={retryMutation.isPending}
                className="text-accent-400 hover:text-accent-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retry
              </Button>
              {retryMutation.isError && (
                <p className="mt-1 text-xs text-red-400">Retry failed: {retryMutation.error.message}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime()
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (minutes < 60) return `${minutes}m ${secs}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
