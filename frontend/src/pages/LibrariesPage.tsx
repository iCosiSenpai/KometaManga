import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Library, type KomfConfig, type MetadataJob, type MetadataProcessingConfig, type JobStatus, type KomgaSeries } from '@/api/client'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { ConfirmDialog, useConfirm } from '@/components/ConfirmDialog'
import { PageSpinner } from '@/components/Spinner'
import { ErrorState } from '@/components/ErrorState'
import { EmptyState } from '@/components/EmptyState'
import { IdentifyDialog } from '@/components/IdentifyDialog'
import {
  Library as LibraryIcon,
  Play,
  RotateCcw,
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FolderOpen,
  Loader2,
  HardDrive,
  Radio,
  Image,
  Layers,
  BookOpen,
  Settings,
} from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { clsx } from 'clsx'
import { Link } from 'react-router-dom'
import { useToast } from '@/components/Toast'

const TYPE_LABEL: Record<string, string> = {
  MANGA: 'Manga',
  NOVEL: 'Novel',
  COMIC: 'Comic',
  WEBTOON: 'Webtoon',
}

const STATUS_ICON: Record<JobStatus, React.ReactNode> = {
  COMPLETED: <CheckCircle2 className="h-3 w-3 text-emerald-400" />,
  FAILED: <XCircle className="h-3 w-3 text-red-400" />,
  RUNNING: <Loader2 className="h-3 w-3 animate-spin text-amber-400" />,
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function LibrariesPage() {
  const queryClient = useQueryClient()

  const connectionQuery = useQuery({
    queryKey: ['connection'],
    queryFn: api.getConnected,
  })

  const librariesQuery = useQuery({
    queryKey: ['libraries'],
    queryFn: api.getLibraries,
    enabled: connectionQuery.data?.success === true,
  })

  const configQuery = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
  })

  const jobsQuery = useQuery({
    queryKey: ['jobs', 'recent'],
    queryFn: () => api.getJobs({ page: 1, pageSize: 50 }),
    refetchInterval: 15_000,
  })

  if (connectionQuery.isLoading || librariesQuery.isLoading) return <PageSpinner />
  if (connectionQuery.isError)
    return <ErrorState message="Cannot reach backend" onRetry={() => connectionQuery.refetch()} />
  if (!connectionQuery.data?.success)
    return <ErrorState message="Not connected to Komga" />

  const libraries = librariesQuery.data ?? []
  const totalRoots = libraries.reduce((sum, l) => sum + l.roots.length, 0)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Libraries"
        description="Komga library configuration, metadata actions, and recent activity."
      />

      {libraries.length === 0 ? (
        <EmptyState
          icon={<LibraryIcon className="h-10 w-10" />}
          title="No libraries found"
          description="Make sure your Komga instance has libraries configured."
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-ink-800/30 bg-ink-900/30 px-3 py-2">
              <LibraryIcon className="h-3.5 w-3.5 text-accent-400" />
              <span className="text-xs text-ink-400">
                <span className="font-semibold text-ink-200">{libraries.length}</span>{' '}
                {libraries.length === 1 ? 'library' : 'libraries'}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-ink-800/30 bg-ink-900/30 px-3 py-2">
              <HardDrive className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs text-ink-400">
                <span className="font-semibold text-ink-200">{totalRoots}</span> root{' '}
                {totalRoots === 1 ? 'path' : 'paths'}
              </span>
            </div>
          </div>
          <div className="space-y-4">
            {libraries.map((lib) => (
              <LibraryCard
                key={lib.id}
                library={lib}
                config={configQuery.data ?? null}
                jobs={jobsQuery.data?.content ?? []}
                queryClient={queryClient}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Library Card
// ---------------------------------------------------------------------------

type ActionResult = { type: 'success' | 'error'; message: string } | null

function LibraryCard({
  library,
  config,
  jobs,
  queryClient,
}: {
  library: Library
  config: KomfConfig | null
  jobs: MetadataJob[]
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const { toast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const [expanded, setExpanded] = useState(false)
  const [identifyOpen, setIdentifyOpen] = useState(false)
  const [smartMatchOpen, setSmartMatchOpen] = useState(false)
  const [result, setResult] = useState<ActionResult>(null)
  const [selectedSeries, setSelectedSeries] = useState<KomgaSeries | null>(null)
  const [seriesSearch, setSeriesSearch] = useState('')
  const [debouncedSeriesSearch, setDebouncedSeriesSearch] = useState('')
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())

  // Fetch all series names for this library (for resolving IDs in recent activity)
  const allSeriesQuery = useQuery({
    queryKey: ['library-series-all', library.id],
    queryFn: () => api.getLibrarySeries(library.id),
    staleTime: 60_000 * 5,
  })
  const seriesNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of allSeriesQuery.data ?? []) map.set(s.id, s.name)
    return map
  }, [allSeriesQuery.data])

  // Debounce series search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSeriesSearch(seriesSearch), 300)
    return () => clearTimeout(t)
  }, [seriesSearch])

  const seriesQuery = useQuery({
    queryKey: ['library-series', library.id, debouncedSeriesSearch],
    queryFn: () => api.getLibrarySeries(library.id, debouncedSeriesSearch || undefined),
    enabled: debouncedSeriesSearch.length >= 1 && expanded,
  })

  // Per-library config (falls back to default)
  const libConfig: MetadataProcessingConfig | null = useMemo(() => {
    if (!config) return null
    return config.komga.metadataUpdate.library[library.id] ?? config.komga.metadataUpdate.default
  }, [config, library.id])

  const hasCustomConfig = config
    ? !!config.komga.metadataUpdate.library[library.id]
    : false

  // Event listener status for this library
  const eventListener = config?.komga.eventListener
  const isMonitored = eventListener
    ? eventListener.enabled &&
      (eventListener.metadataLibraryFilter.length === 0 ||
        eventListener.metadataLibraryFilter.includes(library.id))
    : false

  // Recent jobs (global — no per-library filtering available in API)
  const recentJobs = useMemo(() => jobs.slice(0, 5), [jobs])
  const jobStats = useMemo(() => {
    const completed = jobs.filter((j) => j.status === 'COMPLETED').length
    const failed = jobs.filter((j) => j.status === 'FAILED').length
    const running = jobs.filter((j) => j.status === 'RUNNING').length
    return { completed, failed, running, total: jobs.length }
  }, [jobs])

  // --- Mutations ---
  const matchLibrary = useMutation({
    mutationFn: () => api.matchLibrary(library.id),
    onSuccess: () => {
      setResult({ type: 'success', message: 'Match all started. Check Jobs page.' })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (e) => setResult({ type: 'error', message: (e as Error).message }),
  })

  const resetLibrary = useMutation({
    mutationFn: (removeComicInfo: boolean) => api.resetLibrary(library.id, removeComicInfo),
    onSuccess: () => setResult({ type: 'success', message: 'Library metadata reset.' }),
    onError: (e) => setResult({ type: 'error', message: (e as Error).message }),
  })

  const matchSeries = useMutation({
    mutationFn: () => {
      if (!selectedSeries) throw new Error('No series selected')
      return api.matchSeries(library.id, selectedSeries.id)
    },
    onSuccess: (data) => {
      setResult({ type: 'success', message: `Match started for "${selectedSeries?.name}" (job ${data.jobId}). Check Jobs page.` })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (e) => setResult({ type: 'error', message: (e as Error).message }),
  })

  const resetSeries = useMutation({
    mutationFn: (removeComicInfo: boolean) => {
      if (!selectedSeries) throw new Error('No series selected')
      return api.resetSeries(library.id, selectedSeries.id, removeComicInfo)
    },
    onSuccess: () => setResult({ type: 'success', message: `Series "${selectedSeries?.name}" metadata reset.` }),
    onError: (e) => setResult({ type: 'error', message: (e as Error).message }),
  })

  const bulkMatch = useMutation({
    mutationFn: () => api.matchBulk(Array.from(bulkSelected)),
    onSuccess: (data) => {
      setResult({ type: 'success', message: `Bulk match started: ${data.jobIds.length} jobs queued. Check Jobs page.` })
      setBulkSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (e) => setResult({ type: 'error', message: (e as Error).message }),
  })

  const smartBulkMatch = useMutation({
    mutationFn: (seriesIds: string[]) => api.matchBulk(seriesIds),
    onSuccess: (data) => {
      setResult({ type: 'success', message: `Matching ${data.jobIds.length} new series. Check Jobs page.` })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (e) => setResult({ type: 'error', message: (e as Error).message }),
  })

  const anyPending =
    matchLibrary.isPending ||
    resetLibrary.isPending ||
    matchSeries.isPending ||
    resetSeries.isPending ||
    bulkMatch.isPending ||
    smartBulkMatch.isPending

  return (
    <>
      <ConfirmDialog {...dialogProps} />
      <Card>
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-600/10 ring-1 ring-accent-500/10">
              <LibraryIcon className="h-5 w-5 text-accent-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-semibold text-ink-100">
                  {library.name}
                </h3>
                {libConfig && (
                  <span className="rounded-md bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-ink-400">
                    {TYPE_LABEL[libConfig.libraryType] ?? libConfig.libraryType}
                  </span>
                )}
                {hasCustomConfig && (
                  <span className="rounded-md bg-violet-950/50 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
                    Custom
                  </span>
                )}
              </div>
              {library.roots.length > 0 && (
                <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
                  <FolderOpen className="h-3 w-3 shrink-0" />
                  <span className="max-w-xs truncate">{library.roots[0]}</span>
                  {library.roots.length > 1 && (
                    <span className="text-ink-600">+{library.roots.length - 1} more</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={matchLibrary.isPending}
              disabled={anyPending}
              onClick={() => setSmartMatchOpen(true)}
            >
              <Play className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Match All</span>
            </Button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-200"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Config summary strip */}
        {libConfig && (
          <div className="mt-3 flex flex-wrap gap-2">
            <ConfigPill
              icon={<Radio className="h-3 w-3" />}
              label={isMonitored ? 'Auto-scan ON' : 'Auto-scan OFF'}
              active={isMonitored}
            />
            <ConfigPill
              icon={<Image className="h-3 w-3" />}
              label={libConfig.seriesCovers ? 'Covers ON' : 'Covers OFF'}
              active={libConfig.seriesCovers}
            />
            <ConfigPill
              icon={<BookOpen className="h-3 w-3" />}
              label={libConfig.updateModes.join(' + ')}
              active
            />
            {libConfig.aggregate && (
              <ConfigPill
                icon={<Layers className="h-3 w-3" />}
                label="Aggregate"
                active
              />
            )}
          </div>
        )}

        {/* Progress bar */}
        {anyPending && (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Processing request…</span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink-800">
              <div className="h-full w-full animate-pulse rounded-full bg-amber-500/60" />
            </div>
          </div>
        )}

        {/* Result banner */}
        {result && (
          <div
            className={clsx(
              'mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
              result.type === 'success'
                ? 'border border-emerald-900/30 bg-emerald-950/20 text-emerald-400'
                : 'border border-red-900/30 bg-red-950/20 text-red-400',
            )}
          >
            {result.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            {result.message}
            <button
              onClick={() => setResult(null)}
              className="ml-auto text-xs opacity-60 hover:opacity-100"
            >
              dismiss
            </button>
          </div>
        )}

        {/* Expanded section */}
        {expanded && (
          <div className="mt-4 space-y-5 border-t border-ink-800/50 pt-4">
            {/* Config overview */}
            {libConfig && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Configuration
                  </h4>
                  <Link
                    to="/settings/processing"
                    className="flex items-center gap-1 text-[11px] text-accent-400 hover:text-accent-300"
                  >
                    <Settings className="h-3 w-3" /> Edit
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <ConfigDetail label="Type" value={TYPE_LABEL[libConfig.libraryType] ?? libConfig.libraryType} />
                  <ConfigDetail label="Covers" value={libConfig.seriesCovers ? 'Series + Book' : libConfig.bookCovers ? 'Book only' : 'Off'} />
                  <ConfigDetail label="Update Mode" value={libConfig.updateModes.join(', ')} />
                  <ConfigDetail label="Merge Tags" value={libConfig.mergeTags ? 'Yes' : 'No'} />
                  <ConfigDetail label="Aggregate" value={libConfig.aggregate ? 'Yes' : 'No'} />
                  <ConfigDetail label="Lock Covers" value={libConfig.lockCovers ? 'Yes' : 'No'} />
                  <ConfigDetail label="Override Covers" value={libConfig.overrideExistingCovers ? 'Yes' : 'No'} />
                  <ConfigDetail label="Config" value={hasCustomConfig ? 'Per-library' : 'Default'} />
                </div>
              </div>
            )}

            {/* Recent activity */}
            {recentJobs.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Recent Activity
                  </h4>
                  <Link
                    to="/jobs"
                    className="text-[11px] text-accent-400 hover:text-accent-300"
                  >
                    View all →
                  </Link>
                </div>
                <div className="space-y-1">
                  {recentJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
                    >
                      {STATUS_ICON[job.status]}
                      <span className="min-w-0 flex-1 truncate text-ink-300">
                        {job.message ?? seriesNameMap.get(job.seriesId) ?? job.seriesId}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-ink-600">
                        {formatTimeAgo(job.startedAt)}
                      </span>
                    </div>
                  ))}
                </div>
                {jobStats.total > 0 && (
                  <div className="mt-2 flex gap-4 border-t border-ink-800/30 pt-2">
                    <span className="text-[10px] text-emerald-400">{jobStats.completed} OK</span>
                    <span className="text-[10px] text-red-400">{jobStats.failed} Failed</span>
                    <span className="text-[10px] text-amber-400">{jobStats.running} Running</span>
                  </div>
                )}
              </div>
            )}

            {/* Library-level actions */}
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
                Library Actions
              </h4>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" loading={matchLibrary.isPending} disabled={anyPending} onClick={() => setSmartMatchOpen(true)}>
                  <Play className="h-3.5 w-3.5" /> Match All Series
                </Button>
                <Button variant="ghost" size="sm" loading={resetLibrary.isPending} disabled={anyPending} onClick={() => confirm(`Reset all metadata for "${library.name}"?`, () => resetLibrary.mutate(false))}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reset Metadata
                </Button>
                <Button variant="ghost" size="sm" loading={resetLibrary.isPending} disabled={anyPending} onClick={() => confirm(`Reset all metadata + remove ComicInfo for "${library.name}"? This cannot be undone.`, () => resetLibrary.mutate(true))}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reset + ComicInfo
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setIdentifyOpen(true)}>
                  <Search className="h-3.5 w-3.5" /> Identify Series…
                </Button>
              </div>
            </div>

            {/* Series-level actions */}
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
                Series Actions
              </h4>
              <div className="space-y-3">
                {/* Series search */}
                <div className="relative">
                  <label className="mb-1 block text-xs text-ink-500">Search series by name</label>
                  <input
                    type="text"
                    value={seriesSearch}
                    onChange={(e) => { setSeriesSearch(e.target.value); setSelectedSeries(null) }}
                    placeholder="Type series name…"
                    className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 text-sm text-ink-100 placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
                  />
                  {/* Dropdown results */}
                  {seriesSearch && !selectedSeries && (
                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 shadow-xl">
                      {seriesQuery.isLoading && (
                        <p className="px-3 py-2 text-xs text-ink-500">Searching…</p>
                      )}
                      {seriesQuery.data && seriesQuery.data.length === 0 && (
                        <p className="px-3 py-2 text-xs text-ink-500">No series found</p>
                      )}
                      {seriesQuery.data?.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => { setSelectedSeries(s); setSeriesSearch(s.name) }}
                          className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-ink-200 hover:bg-ink-800"
                        >
                          <input
                            type="checkbox"
                            aria-label={`Select ${s.name}`}
                            checked={bulkSelected.has(s.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation()
                              setBulkSelected((prev) => {
                                const next = new Set(prev)
                                if (next.has(s.id)) next.delete(s.id); else next.add(s.id)
                                return next
                              })
                            }}
                            className="h-3.5 w-3.5 shrink-0 rounded border-ink-600 bg-ink-800 accent-accent-500"
                          />
                          <BookOpen className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                          <span className="truncate">{s.name}</span>
                          <span className="ml-auto shrink-0 text-[10px] text-ink-600">{s.booksCount} vol</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected series indicator */}
                {selectedSeries && (
                  <div className="flex items-center gap-2 rounded-lg border border-accent-800/20 bg-accent-950/10 px-3 py-2">
                    <BookOpen className="h-3.5 w-3.5 text-accent-400" />
                    <span className="text-sm text-ink-200">{selectedSeries.name}</span>
                    <span className="text-xs text-ink-500">({selectedSeries.booksCount} books)</span>
                    <button
                      onClick={() => { setSelectedSeries(null); setSeriesSearch('') }}
                      className="ml-auto text-xs text-ink-500 hover:text-ink-300"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" disabled={!selectedSeries || anyPending} loading={matchSeries.isPending} onClick={() => matchSeries.mutate()}>
                    <Play className="h-3.5 w-3.5" /> Match
                  </Button>
                  <Button variant="ghost" size="sm" disabled={!selectedSeries || anyPending} loading={resetSeries.isPending} onClick={() => confirm(`Reset metadata for "${selectedSeries?.name}"?`, () => resetSeries.mutate(false))}>
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </Button>
                  <Button variant="ghost" size="sm" disabled={!selectedSeries || anyPending} loading={resetSeries.isPending} onClick={() => confirm(`Reset metadata + remove ComicInfo for "${selectedSeries?.name}"?`, () => resetSeries.mutate(true))}>
                    <RotateCcw className="h-3.5 w-3.5" /> Reset + CI
                  </Button>
                </div>

                {/* Bulk selection bar */}
                {bulkSelected.size > 0 && (
                  <div className="flex items-center gap-3 rounded-lg border border-accent-800/30 bg-accent-950/10 px-3 py-2">
                    <span className="text-xs text-accent-400">{bulkSelected.size} series selected</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={bulkMatch.isPending}
                      disabled={anyPending}
                      onClick={() => confirm(`Start bulk match for ${bulkSelected.size} series?`, () => bulkMatch.mutate())}
                    >
                      <Play className="h-3.5 w-3.5" /> Bulk Match
                    </Button>
                    <button
                      onClick={() => setBulkSelected(new Set())}
                      className="text-xs text-ink-500 hover:text-ink-300"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {identifyOpen && (
        <IdentifyDialog
          libraryId={library.id}
          libraryName={library.name}
          onClose={() => setIdentifyOpen(false)}
          onJobStarted={(jobId) =>
            setResult({ type: 'success', message: `Identify job started: ${jobId}` })
          }
        />
      )}

      {smartMatchOpen && (
        <SmartMatchDialog
          libraryId={library.id}
          libraryName={library.name}
          onClose={() => setSmartMatchOpen(false)}
          onMatchAll={() => {
            setSmartMatchOpen(false)
            matchLibrary.mutate()
          }}
          onMatchNew={(seriesIds) => {
            setSmartMatchOpen(false)
            if (seriesIds.length === 0) {
              toast('All series already have metadata — nothing to do', 'info')
              return
            }
            smartBulkMatch.mutate(seriesIds)
          }}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

function ConfigPill({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
        active
          ? 'bg-accent-600/10 text-accent-400'
          : 'bg-ink-800/50 text-ink-500',
      )}
    >
      {icon}
      {label}
    </span>
  )
}

function ConfigDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-950/40 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-ink-600">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-ink-200">{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Smart Match Dialog — detects already-matched series before running Match All
// ---------------------------------------------------------------------------

function SmartMatchDialog({
  libraryId,
  libraryName,
  onClose,
  onMatchAll,
  onMatchNew,
}: {
  libraryId: string
  libraryName: string
  onClose: () => void
  onMatchAll: () => void
  onMatchNew: (newSeriesIds: string[]) => void
}) {
  const seriesQuery = useQuery({
    queryKey: ['library-series-all', libraryId],
    queryFn: () => api.getLibrarySeries(libraryId),
    staleTime: 60_000,
  })

  // Fetch ALL completed jobs (not just recent 50) to accurately detect existing metadata
  const completedJobsQuery = useQuery({
    queryKey: ['jobs', 'all-completed'],
    queryFn: () => api.getJobs({ status: 'COMPLETED', page: 1, pageSize: 5000 }),
    staleTime: 30_000,
  })

  const allSeries = seriesQuery.data ?? []
  const completedJobs = completedJobsQuery.data?.content ?? []

  // Build set of series IDs that already have a COMPLETED job
  const matchedIds = useMemo(() => {
    const set = new Set<string>()
    for (const j of completedJobs) {
      set.add(j.seriesId)
    }
    return set
  }, [completedJobs])

  const alreadyMatched = allSeries.filter((s) => matchedIds.has(s.id))
  const newSeries = allSeries.filter((s) => !matchedIds.has(s.id))
  const loading = seriesQuery.isLoading || completedJobsQuery.isLoading

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[10vh] backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl border border-ink-800/60 bg-ink-950 shadow-2xl">
        {/* Header */}
        <div className="border-b border-ink-800/50 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink-100">
            Match All — {libraryName}
          </h2>
        </div>

        <div className="space-y-4 p-6">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-ink-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking library…
            </div>
          ) : allSeries.length === 0 ? (
            <p className="py-4 text-sm text-ink-400">No series found in this library.</p>
          ) : alreadyMatched.length === 0 ? (
            <>
              <p className="text-sm text-ink-300">
                <span className="font-semibold text-ink-100">{allSeries.length}</span> series found.
                No previous metadata detected — ready to match.
              </p>
              <div className="flex gap-2 pt-2">
                <Button variant="primary" size="sm" onClick={onMatchAll}>
                  <Play className="h-3.5 w-3.5" /> Match All ({allSeries.length})
                </Button>
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-amber-900/30 bg-amber-950/20 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Existing metadata found
                </p>
                <p className="mt-1 text-xs text-amber-400/70">
                  <span className="font-semibold text-amber-300">{alreadyMatched.length}</span> of{' '}
                  <span className="font-semibold text-amber-300">{allSeries.length}</span> series already have
                  metadata from a previous fetch.
                </p>
              </div>

              {/* Preview lists */}
              <div className="grid gap-3">
                {newSeries.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      New ({newSeries.length})
                    </p>
                    <div className="max-h-28 space-y-0.5 overflow-y-auto rounded-lg bg-ink-900/50 p-2">
                      {newSeries.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 text-xs text-ink-300">
                          <BookOpen className="h-3 w-3 shrink-0 text-emerald-400/60" />
                          <span className="truncate">{s.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Already matched ({alreadyMatched.length})
                  </p>
                  <div className="max-h-28 space-y-0.5 overflow-y-auto rounded-lg bg-ink-900/50 p-2">
                    {alreadyMatched.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-xs text-ink-500">
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-ink-600" />
                        <span className="truncate">{s.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 border-t border-ink-800/40 pt-3">
                {newSeries.length > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onMatchNew(newSeries.map((s) => s.id))}
                  >
                    <Play className="h-3.5 w-3.5" /> Only New ({newSeries.length})
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={onMatchAll}>
                  <RotateCcw className="h-3.5 w-3.5" /> Replace All ({allSeries.length})
                </Button>
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
