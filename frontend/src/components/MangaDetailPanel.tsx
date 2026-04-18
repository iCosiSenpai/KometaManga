import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FolderOpen,
  Heart,
  HeartOff,
  Languages,
  Search,
  Sparkles,
} from 'lucide-react'
import { api, imageProxyUrl, type DownloadTarget } from '@/api/client'
import type { MangaChapterDto, MangaSourceId } from '@/api/sources'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'
import { Flag } from '@/components/Flag'
import { SourceIcon } from '@/components/SourceIcon'
import { SOURCE_BRAND, langLabel, type SourceBrand } from '@/lib/brand'

interface MangaDetailPanelProps {
  sourceId: MangaSourceId
  mangaId: string
  initialTitle: string
  initialCoverUrl?: string | null
  initialLanguage?: string | null
  onBack: () => void
  onDownload: (
    sourceId: MangaSourceId,
    mangaId: string,
    chapterIds: string[],
    target?: { libraryPath: string | null; libraryId: string | null },
  ) => void
  downloadLoading?: boolean
}

const STATUS_META: Record<
  'ONGOING' | 'COMPLETED' | 'HIATUS' | 'CANCELLED' | 'UNKNOWN',
  string
> = {
  ONGOING: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20',
  COMPLETED: 'bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/20',
  HIATUS: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20',
  CANCELLED: 'bg-red-500/10 text-red-300 ring-1 ring-red-500/20',
  UNKNOWN: 'bg-ink-800/80 text-ink-300 ring-1 ring-ink-700/60',
}

type SourceMetaEntry = SourceBrand

function formatChapterUpdate(updatedAt: string | null) {
  if (!updatedAt) return null
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function MangaDetailPanel({
  sourceId,
  mangaId,
  initialTitle,
  initialCoverUrl,
  initialLanguage,
  onBack,
  onDownload,
  downloadLoading,
}: MangaDetailPanelProps) {
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set())
  const [languageFilter, setLanguageFilter] = useState<string | null>(initialLanguage ?? null)
  const [sortAsc, setSortAsc] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [showFollowDialog, setShowFollowDialog] = useState(false)
  const [chapterLimit, setChapterLimit] = useState(50)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const sourceMeta = SOURCE_BRAND[sourceId]

  const detailsQuery = useQuery({
    queryKey: ['manga-details', sourceId, mangaId],
    queryFn: () => api.getMangaDetails(sourceId, mangaId),
  })

  const configQuery = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
    staleTime: 60_000,
  })

  const downloadTargets = useMemo<DownloadTarget[]>(() => {
    const dl = configQuery.data?.download
    if (!dl) return []
    const defaultTarget: DownloadTarget = {
      id: 'default',
      name: 'Default',
      containerPath: dl.downloadDir,
      komgaLibraryId: dl.komgaLibraryId,
      komgaLibraryPath: dl.komgaLibraryPath,
    }
    return [defaultTarget, ...(dl.extraTargets ?? [])]
  }, [configQuery.data])

  const [selectedTargetId, setSelectedTargetId] = useState<string>(() => {
    try { return localStorage.getItem('kometa.lastDownloadTargetId') ?? 'default' }
    catch { return 'default' }
  })

  useEffect(() => {
    if (downloadTargets.length === 0) return
    if (!downloadTargets.some((t) => t.id === selectedTargetId)) {
      setSelectedTargetId(downloadTargets[0]!.id)
    }
  }, [downloadTargets, selectedTargetId])

  const activeTarget = useMemo(
    () => downloadTargets.find((t) => t.id === selectedTargetId) ?? downloadTargets[0] ?? null,
    [downloadTargets, selectedTargetId],
  )

  const resolveTargetPayload = useCallback(() => {
    if (!activeTarget) return undefined
    return {
      libraryPath: activeTarget.containerPath,
      libraryId: activeTarget.komgaLibraryId,
    }
  }, [activeTarget])

  const chaptersQuery = useQuery({
    queryKey: ['manga-chapters', sourceId, mangaId, languageFilter],
    queryFn: () => api.getMangaChapters(sourceId, mangaId, languageFilter ?? undefined),
  })

  const rulesQuery = useQuery({
    queryKey: ['auto-downloader-rules'],
    queryFn: api.getAutoDownloaderRules,
  })

  const details = detailsQuery.data
  const chapters = chaptersQuery.data ?? []
  const title = details?.title ?? initialTitle
  const coverUrl = details?.coverUrl ?? initialCoverUrl
  const existingRule = useMemo(
    () => (rulesQuery.data ?? []).find((rule) => rule.sourceId === sourceId && rule.mangaId === mangaId),
    [rulesQuery.data, sourceId, mangaId],
  )
  const isFollowing = Boolean(existingRule)

  const followMutation = useMutation({
    mutationFn: () =>
      api.createAutoDownloaderRule({
        sourceId,
        mangaId,
        mangaTitle: title,
        language: languageFilter,
        enabled: true,
        komgaLibraryId: activeTarget?.komgaLibraryId ?? null,
        komgaLibraryPath: activeTarget?.containerPath ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-rules'] })
      toast('Following enabled — new chapters will auto-download', 'success')
      setShowFollowDialog(false)
    },
    onError: (error: Error) => {
      toast(error.message || 'Failed to follow', 'error')
      setShowFollowDialog(false)
    },
  })

  const unfollowMutation = useMutation({
    mutationFn: () => {
      if (!existingRule) throw new Error('No follow rule found')
      return api.deleteAutoDownloaderRule(existingRule.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-rules'] })
      toast('Auto-download follow removed', 'success')
    },
    onError: (error: Error) => {
      toast(error.message || 'Failed to unfollow', 'error')
    },
  })

  const languages = useMemo(() => {
    const langSet = new Set<string>()
    for (const chapter of chapters) {
      if (chapter.language) langSet.add(chapter.language)
    }
    return Array.from(langSet).sort()
  }, [chapters])

  const sortedChapters = useMemo(() => {
    const sorted = [...chapters].sort((left, right) => {
      const leftNumber = parseFloat(left.chapterNumber) || 0
      const rightNumber = parseFloat(right.chapterNumber) || 0
      return sortAsc ? leftNumber - rightNumber : rightNumber - leftNumber
    })
    return sorted
  }, [chapters, sortAsc])

  const displayedChapters = useMemo(
    () => sortedChapters.slice(0, chapterLimit),
    [sortedChapters, chapterLimit],
  )

  useEffect(() => {
    const validIds = new Set(chapters.map((chapter) => chapter.id))
    setSelectedChapters((previous) => {
      const next = new Set(Array.from(previous).filter((id) => validIds.has(id)))
      if (next.size === previous.size) return previous
      return next
    })
  }, [chapters])

  const metadataPills = useMemo(() => {
    const genres = details?.genres ?? []
    const tags = details?.tags ?? []
    return [...genres, ...tags].filter(Boolean).slice(0, 14)
  }, [details?.genres, details?.tags])

  const toggleChapter = useCallback((id: string) => {
    setSelectedChapters((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedChapters(new Set(sortedChapters.map((chapter) => chapter.id)))
  }, [sortedChapters])

  const deselectAll = useCallback(() => {
    setSelectedChapters(new Set())
  }, [])

  const handleDownload = useCallback(() => {
    if (selectedChapters.size === 0) return
    if (activeTarget) {
      try { localStorage.setItem('kometa.lastDownloadTargetId', activeTarget.id) } catch {}
    }
    onDownload(sourceId, mangaId, Array.from(selectedChapters), resolveTargetPayload())
    setSelectedChapters(new Set())
  }, [activeTarget, mangaId, onDownload, resolveTargetPayload, selectedChapters, sourceId])

  const selectedCount = selectedChapters.size
  const chapterCount = sortedChapters.length
  const activeLanguageLabel = languageFilter ? langLabel(languageFilter) : 'ALL'
  const statusLabel = details?.status ?? 'UNKNOWN'
  const description = details?.description?.trim() ?? ''
  const alternativeTitles = (details?.alternativeTitles ?? [])
    .filter((entry) => entry && entry !== title)
    .slice(0, 4)
  const coverImage = imageProxyUrl(coverUrl) ?? coverUrl ?? undefined

  if (detailsQuery.isLoading && !details && chaptersQuery.isLoading && chapters.length === 0) {
    return <MangaDetailSkeleton />
  }

  if (detailsQuery.isError && !details && chaptersQuery.isError && chapters.length === 0) {
    return (
      <div className="animate-page-in space-y-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-ink-400 transition-colors hover:text-ink-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to search
        </button>
        <ErrorState
          message="Failed to load this manga dossier"
          hint="The source did not return details or chapters. Try again in a moment."
          onRetry={() => {
            detailsQuery.refetch()
            chaptersQuery.refetch()
          }}
        />
      </div>
    )
  }

  return (
    <div className="animate-page-in space-y-8 pb-28">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-ink-950/50 px-4 py-2 text-sm text-ink-300 transition-colors hover:border-white/15 hover:bg-ink-900/80 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to source deck
      </button>

      <FollowDialog
        open={showFollowDialog}
        sourceMeta={sourceMeta}
        title={title}
        activeLanguageLabel={activeLanguageLabel}
        loading={followMutation.isPending}
        chapterCount={chapterCount}
        downloadTargets={downloadTargets}
        selectedTargetId={selectedTargetId}
        onSelectTarget={setSelectedTargetId}
        onClose={() => setShowFollowDialog(false)}
        onConfirm={(downloadExisting) => {
          followMutation.mutate(undefined, {
            onSuccess: () => {
              if (downloadExisting && sortedChapters.length > 0) {
                if (activeTarget) {
                  try { localStorage.setItem('kometa.lastDownloadTargetId', activeTarget.id) } catch {}
                }
                onDownload(
                  sourceId,
                  mangaId,
                  sortedChapters.map((ch) => ch.id),
                  resolveTargetPayload(),
                )
              }
            },
          })
        }}
      />

      <DetailHero
        sourceMeta={sourceMeta}
        sourceId={sourceId}
        languageFilter={languageFilter}
        mangaId={mangaId}
        coverImage={coverImage}
        title={title}
        activeLanguageLabel={activeLanguageLabel}
        isFollowing={isFollowing}
        followLanguage={existingRule?.language ?? null}
        statusLabel={statusLabel}
        year={details?.year ?? null}
        chapterCount={chapterCount}
        selectedCount={selectedCount}
        alternativeTitles={alternativeTitles}
        description={description}
        descExpanded={descExpanded}
        onToggleDescription={() => setDescExpanded((previous) => !previous)}
        authors={details?.authors ?? []}
        artists={details?.artists ?? []}
        metadataPills={metadataPills}
        onToggleFollow={() => (isFollowing ? unfollowMutation.mutate() : setShowFollowDialog(true))}
        followLoading={followMutation.isPending || unfollowMutation.isPending}
        onDownloadSelected={handleDownload}
        downloadLoading={downloadLoading}
        downloadTargets={downloadTargets}
        selectedTargetId={selectedTargetId}
        onSelectTarget={setSelectedTargetId}
      />

      {(detailsQuery.isError || rulesQuery.isError) && (
        <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
          <span>
            {detailsQuery.isError
              ? 'Some metadata could not be refreshed from the source.'
              : 'Follow status could not be refreshed right now.'}
          </span>
          <button
            onClick={() => {
              if (detailsQuery.isError) detailsQuery.refetch()
              if (rulesQuery.isError) rulesQuery.refetch()
            }}
            className="rounded-full border border-amber-300/20 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-amber-100 transition-colors hover:bg-amber-500/10"
          >
            Retry signal
          </button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <SelectionRail
          languages={languages}
          languageFilter={languageFilter}
          onLanguageChange={setLanguageFilter}
          selectedCount={selectedCount}
          chapterCount={chapterCount}
          sortAsc={sortAsc}
          onToggleSort={() => setSortAsc((previous) => !previous)}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          isFollowing={isFollowing}
          onToggleFollow={() => (isFollowing ? unfollowMutation.mutate() : setShowFollowDialog(true))}
          followLoading={followMutation.isPending || unfollowMutation.isPending}
        />

        <ChapterSection
          sourceMeta={sourceMeta}
          selectedCount={selectedCount}
          loading={chaptersQuery.isLoading && chapterCount === 0}
          error={chaptersQuery.isError}
          onRetry={() => chaptersQuery.refetch()}
          chapters={displayedChapters}
          totalChapters={sortedChapters.length}
          chapterLimit={chapterLimit}
          onChapterLimitChange={setChapterLimit}
          selectedChapters={selectedChapters}
          onToggleChapter={toggleChapter}
          languageFilter={languageFilter}
          onClearLanguageFilter={() => setLanguageFilter(null)}
        />
      </div>

      <StickyBatchBar
        visible={selectedCount > 0}
        selectedCount={selectedCount}
        sourceMeta={sourceMeta}
        onClear={deselectAll}
        onDownload={handleDownload}
        downloadLoading={downloadLoading}
      />
    </div>
  )
}

function FollowDialog({
  open,
  sourceMeta,
  title,
  activeLanguageLabel,
  loading,
  chapterCount,
  downloadTargets,
  selectedTargetId,
  onSelectTarget,
  onClose,
  onConfirm,
}: {
  open: boolean
  sourceMeta: SourceMetaEntry
  title: string
  activeLanguageLabel: string
  loading: boolean
  chapterCount: number
  downloadTargets: DownloadTarget[]
  selectedTargetId: string
  onSelectTarget: (id: string) => void
  onClose: () => void
  onConfirm: (downloadExisting: boolean) => void
}) {
  const [downloadExisting, setDownloadExisting] = useState(false)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/10 bg-ink-950 shadow-[0_32px_120px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={clsx('absolute inset-0 bg-gradient-to-br opacity-100', sourceMeta.accentGlow)} />
        <div className="relative p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.28em] text-ink-400">
                <Heart className="h-3.5 w-3.5 text-rose-300" />
                Auto-download follow
              </div>
              <div>
                <h3 className="font-display text-2xl font-semibold tracking-tight text-ink-100">
                  Follow this manga?
                </h3>
                <p className="mt-2 max-w-md text-sm leading-7 text-ink-300">
                  We&apos;ll create an auto-downloader rule for{' '}
                  <span className="font-semibold text-ink-100">{title}</span> so future chapters can
                  land automatically.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-ink-400 transition-colors hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.28em] text-ink-500">
              <AlertTriangle className="h-3.5 w-3.5" />
              What happens next
            </div>
            <div className="mt-4 space-y-3">
              <QuickActionRow label="Rule target" value={sourceMeta.label} />
              <QuickActionRow label="Language lane" value={activeLanguageLabel} />
              <QuickActionRow label="Behavior" value="New chapters download automatically" />
              <QuickActionRow label="Control room" value="Manage or disable it in Auto-Downloader" />
            </div>
          </div>

          {chapterCount > 0 && (
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <input
                  type="checkbox"
                  checked={downloadExisting}
                  onChange={(e) => setDownloadExisting(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-transparent accent-rose-500"
                />
                <div>
                  <span className="text-sm font-medium text-ink-200">Also download existing chapters</span>
                  <p className="text-xs text-ink-500">Queue all {chapterCount} available chapters for download now</p>
                </div>
              </label>
              {downloadExisting && downloadTargets.length > 1 && (
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <FolderOpen className="h-4 w-4 shrink-0 text-ink-400" />
                  <span className="text-xs text-ink-400">Download to</span>
                  <select
                    value={selectedTargetId}
                    onChange={(e) => onSelectTarget(e.target.value)}
                    aria-label="Download target"
                    className="flex-1 rounded-xl border border-white/10 bg-ink-950/60 px-3 py-1.5 text-sm text-ink-200 outline-none transition-colors focus:border-accent-500"
                  >
                    {downloadTargets.map((t) => (
                      <option key={t.id} value={t.id} className="bg-ink-900 text-ink-100">
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => onConfirm(downloadExisting)}
              loading={loading}
              className="bg-rose-500/90 text-white hover:bg-rose-400"
            >
              <Heart className="h-4 w-4" />
              Confirm follow
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailHero({
  sourceMeta,
  sourceId,
  languageFilter,
  mangaId,
  coverImage,
  title,
  activeLanguageLabel,
  isFollowing,
  followLanguage,
  statusLabel,
  year,
  chapterCount,
  selectedCount,
  alternativeTitles,
  description,
  descExpanded,
  onToggleDescription,
  authors,
  artists,
  metadataPills,
  onToggleFollow,
  followLoading,
  onDownloadSelected,
  downloadLoading,
  downloadTargets,
  selectedTargetId,
  onSelectTarget,
}: {
  sourceMeta: SourceMetaEntry
  sourceId: MangaSourceId
  languageFilter: string | null
  mangaId: string
  coverImage?: string
  title: string
  activeLanguageLabel: string
  isFollowing: boolean
  followLanguage: string | null
  statusLabel: keyof typeof STATUS_META
  year: number | null
  chapterCount: number
  selectedCount: number
  alternativeTitles: string[]
  description: string
  descExpanded: boolean
  onToggleDescription: () => void
  authors: string[]
  artists: string[]
  metadataPills: string[]
  onToggleFollow: () => void
  followLoading: boolean
  onDownloadSelected: () => void
  downloadLoading?: boolean
  downloadTargets: DownloadTarget[]
  selectedTargetId: string
  onSelectTarget: (id: string) => void
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-ink-950 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_32px_120px_rgba(0,0,0,0.45)]">
      <div className={clsx('absolute inset-0 bg-gradient-to-br opacity-100', sourceMeta.accentGlow)} />
      <div className="absolute inset-y-0 left-0 w-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_42%)]" />
      <div className="relative p-5 sm:p-7">
        <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
          <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-ink-950/70 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <div className="aspect-[2/3] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_50%)]">
              {coverImage ? (
                <img
                  src={coverImage}
                  alt={title}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                    <Sparkles className="h-6 w-6 text-white/70" />
                  </div>
                  <p className="font-display text-base font-semibold text-ink-300">No cover</p>
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.22em]',
                  sourceMeta.accentSoft,
                  sourceMeta.accentRing,
                )}
              >
                <SourceIcon sourceId={sourceId} size={12} />
                {sourceMeta.label}
              </span>
              <span className={clsx('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider', STATUS_META[statusLabel])}>
                {statusLabel.toLowerCase()}
              </span>
              {year && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-ink-300">
                  {year}
                </span>
              )}
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-ink-300">
                {chapterCount} ch
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-ink-300">
                <Flag code={languageFilter ?? 'en'} />
                {activeLanguageLabel}
              </span>
              {isFollowing && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-rose-200">
                  <Heart className="h-3 w-3" />
                  Following{followLanguage ? ` · ${followLanguage.toUpperCase()}` : ''}
                </span>
              )}
            </div>

            <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink-100 sm:text-4xl">
              {title}
            </h1>

            {(authors.length > 0 || artists.length > 0) && (
              <p className="text-sm text-ink-400">
                {authors.length > 0 && <span>by <span className="text-ink-200">{authors.join(', ')}</span></span>}
                {authors.length > 0 && artists.length > 0 && ' · '}
                {artists.length > 0 && authors.join(', ') !== artists.join(', ') && (
                  <span>art <span className="text-ink-200">{artists.join(', ')}</span></span>
                )}
              </p>
            )}

            {alternativeTitles.length > 0 && (
              <p className="text-xs leading-6 text-ink-500">
                Also known as {alternativeTitles.join(' • ')}
              </p>
            )}

            {description && (
              <div>
                <p className={clsx('text-sm leading-7 text-ink-300', !descExpanded && 'line-clamp-3')}>
                  {description}
                </p>
                {description.length > 200 && (
                  <button
                    onClick={onToggleDescription}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-400 transition-colors hover:text-white"
                  >
                    {descExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {descExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}

            {metadataPills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {metadataPills.map((pill) => (
                  <span
                    key={pill}
                    className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-ink-300"
                  >
                    {pill}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant={isFollowing ? 'secondary' : 'primary'}
                onClick={onToggleFollow}
                loading={followLoading}
                className={clsx(
                  'justify-center',
                  isFollowing
                    ? 'border-white/10 bg-white/5 text-ink-100 hover:bg-white/10'
                    : 'bg-rose-500 text-white hover:bg-rose-400',
                )}
              >
                {isFollowing ? <HeartOff className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
                {isFollowing ? 'Unfollow' : 'Follow'}
              </Button>
              <Button
                onClick={onDownloadSelected}
                disabled={selectedCount === 0}
                loading={downloadLoading}
                className={clsx(
                  'justify-center',
                  selectedCount === 0
                    ? '!bg-white/5 !text-ink-500 border border-white/10 cursor-not-allowed'
                    : '!bg-accent-600 !text-white hover:!bg-accent-500',
                )}
              >
                <Download className="h-4 w-4" />
                {selectedCount > 0 ? `Download ${selectedCount}` : 'Select chapters'}
              </Button>
              {downloadTargets.length > 1 && (
                <div className="relative">
                  <select
                    value={selectedTargetId}
                    onChange={(e) => onSelectTarget(e.target.value)}
                    aria-label="Download target library"
                    className="appearance-none rounded-2xl border border-white/10 bg-white/5 py-2.5 pl-3 pr-8 text-sm text-ink-200 outline-none transition-colors hover:bg-white/10 focus:border-accent-500"
                  >
                    {downloadTargets.map((t) => (
                      <option key={t.id} value={t.id} className="bg-ink-900 text-ink-100">
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                </div>
              )}
              <a
                href={`${sourceMeta.mangaBaseUrl}${mangaId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-ink-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
                Open on {sourceMeta.label}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function QuickActionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink-500">{label}</span>
      <span className="max-w-[60%] text-right text-sm text-ink-200">{value}</span>
    </div>
  )
}

function SelectionRail({
  languages,
  languageFilter,
  onLanguageChange,
  selectedCount,
  chapterCount,
  sortAsc,
  onToggleSort,
  onSelectAll,
  onDeselectAll,
  isFollowing,
  onToggleFollow,
  followLoading,
}: {
  languages: string[]
  languageFilter: string | null
  onLanguageChange: (language: string | null) => void
  selectedCount: number
  chapterCount: number
  sortAsc: boolean
  onToggleSort: () => void
  onSelectAll: () => void
  onDeselectAll: () => void
  isFollowing: boolean
  onToggleFollow: () => void
  followLoading: boolean
}) {
  return (
    <div className="space-y-6">
      <Card className="rounded-[28px] border-white/10 bg-ink-950/90 p-0 shadow-[0_16px_60px_rgba(0,0,0,0.32)]">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.28em] text-ink-500">
            <Languages className="h-3.5 w-3.5" />
            Selection bay
          </div>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink-100">
            Shape your download run
          </h2>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs">
            <span className="font-mono uppercase tracking-[0.22em] text-ink-500">Selected</span>
            <span className="text-sm font-semibold text-ink-100">
              {selectedCount} / {chapterCount}
            </span>
          </div>

          {(languages.length > 1 || languageFilter) && (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-500">
                Language lane
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => onLanguageChange(null)}
                  className={clsx(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    languageFilter === null
                      ? 'border-white/15 bg-white text-ink-950'
                      : 'border-white/10 bg-white/5 text-ink-300 hover:bg-white/10',
                  )}
                >
                  All languages
                </button>
                {languages.map((language) => (
                  <button
                    key={language}
                    onClick={() => onLanguageChange(language)}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      languageFilter === language
                        ? 'border-white/15 bg-white text-ink-950'
                        : 'border-white/10 bg-white/5 text-ink-300 hover:bg-white/10',
                    )}
                  >
                    <Flag code={language} />
                    {langLabel(language)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Button
              variant="secondary"
              onClick={onToggleSort}
              className="justify-between border-white/10 bg-white/5 text-ink-100 hover:bg-white/10"
            >
              <span>{sortAsc ? 'Ascending order' : 'Descending order'}</span>
              {sortAsc ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="secondary"
              onClick={onSelectAll}
              disabled={chapterCount === 0}
              className="justify-center border-white/10 bg-white/5 text-ink-100 hover:bg-white/10"
            >
              Select all visible
            </Button>
            <Button
              variant="ghost"
              onClick={onDeselectAll}
              disabled={selectedCount === 0}
              className="justify-center rounded-2xl border border-white/10 bg-transparent text-ink-300 hover:bg-white/5 hover:text-white"
            >
              Clear selection
            </Button>
          </div>
        </div>
      </Card>

      <Card className="rounded-[28px] border-white/10 bg-ink-950/90 p-0 shadow-[0_16px_60px_rgba(0,0,0,0.32)]">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.28em] text-ink-500">
            <Heart className="h-3.5 w-3.5" />
            Follow signal
          </div>
          <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-ink-100">
            {isFollowing ? 'Auto-download armed' : 'Auto-download idle'}
          </h2>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm leading-7 text-ink-300">
            {isFollowing
              ? 'Future chapter checks are active for this title. You can keep browsing manually or let the downloader watch for you.'
              : 'If this is a keeper series, enable follow and stop checking the source manually.'}
          </p>
          <Button
            variant={isFollowing ? 'secondary' : 'primary'}
            onClick={onToggleFollow}
            loading={followLoading}
            className={clsx(
              'w-full justify-center',
              isFollowing
                ? 'border-white/10 bg-white/5 text-ink-100 hover:bg-white/10'
                : 'bg-rose-500 text-white hover:bg-rose-400',
            )}
          >
            {isFollowing ? <HeartOff className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
            {isFollowing ? 'Disable follow' : 'Enable follow'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

const CHAPTER_LIMITS = [20, 50, 100, 200] as const

function ChapterSection({
  sourceMeta,
  selectedCount,
  loading,
  error,
  onRetry,
  chapters,
  totalChapters,
  chapterLimit,
  onChapterLimitChange,
  selectedChapters,
  onToggleChapter,
  languageFilter,
  onClearLanguageFilter,
}: {
  sourceMeta: SourceMetaEntry
  selectedCount: number
  loading: boolean
  error: boolean
  onRetry: () => void
  chapters: MangaChapterDto[]
  totalChapters: number
  chapterLimit: number
  onChapterLimitChange: (limit: number) => void
  selectedChapters: Set<string>
  onToggleChapter: (chapterId: string) => void
  languageFilter: string | null
  onClearLanguageFilter: () => void
}) {
  return (
    <Card className="relative overflow-hidden rounded-[28px] border-white/10 bg-ink-950/90 p-0 shadow-[0_16px_60px_rgba(0,0,0,0.32)]">
      <div className={clsx('absolute inset-0 bg-gradient-to-br opacity-100', sourceMeta.accentGlow)} />
      <div className="relative">
        <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.28em] text-ink-500">
              <Search className="h-3.5 w-3.5" />
              Chapter bay
            </div>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-100">
              Browse the release deck
            </h2>
            <p className="mt-2 text-sm leading-7 text-ink-300">
              Select the exact chapters you want, scan the metadata, then send the batch to the
              queue.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-ink-300">
              {chapters.length}/{totalChapters} shown
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-ink-300">
              {selectedCount} selected
            </span>
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              {CHAPTER_LIMITS.map((limit) => (
                <button
                  key={limit}
                  onClick={() => onChapterLimitChange(limit)}
                  className={clsx(
                    'px-2 py-1 text-[10px] font-mono transition-colors',
                    chapterLimit === limit
                      ? 'bg-white/15 text-ink-100'
                      : 'text-ink-500 hover:bg-white/5 hover:text-ink-300',
                  )}
                >
                  {limit}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="mt-4 h-4 w-2/3" />
                  <Skeleton className="mt-3 h-3 w-1/2" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <ErrorState
              message="Failed to load chapters"
              hint="The source did not return the chapter deck right now."
              onRetry={onRetry}
            />
          )}

          {!loading && !error && chapters.length === 0 && (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[24px] border border-dashed border-ink-800/50 bg-ink-950/50 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-ink-800/50 bg-ink-900/50">
                <Languages className="h-6 w-6 text-ink-400" />
              </div>
              {languageFilter ? (
                <>
                  <h3 className="mt-5 font-display text-2xl font-semibold text-ink-100">
                    No chapters in {langLabel(languageFilter)}
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-7 text-ink-400">
                    This manga exists on the source but has no chapters available in {langLabel(languageFilter)}.
                  </p>
                  <button
                    onClick={onClearLanguageFilter}
                    className="mt-4 rounded-full border border-ink-700 bg-ink-900/60 px-4 py-2 text-sm font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-100"
                  >
                    Show all languages
                  </button>
                </>
              ) : (
                <>
                  <h3 className="mt-5 font-display text-2xl font-semibold text-ink-100">
                    No chapters found
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-7 text-ink-400">
                    This source returned no chapters for this title.
                  </p>
                </>
              )}
            </div>
          )}

          {!loading && !error && chapters.length > 0 && (
            <div className="space-y-3">
              {chapters.map((chapter) => (
                <ChapterBayRow
                  key={chapter.id}
                  chapter={chapter}
                  selected={selectedChapters.has(chapter.id)}
                  onToggle={() => onToggleChapter(chapter.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function StickyBatchBar({
  visible,
  selectedCount,
  sourceMeta,
  onClear,
  onDownload,
  downloadLoading,
}: {
  visible: boolean
  selectedCount: number
  sourceMeta: SourceMetaEntry
  onClear: () => void
  onDownload: () => void
  downloadLoading?: boolean
}) {
  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-30 md:left-[calc(16rem+1.5rem)]">
      <div className="mx-auto max-w-6xl rounded-[24px] border border-white/10 bg-ink-950/90 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-500">
              Batch queue
            </p>
            <p className="mt-2 text-sm text-ink-300">
              <span className="font-semibold text-ink-100">{selectedCount}</span> chapter
              {selectedCount !== 1 ? 's are' : ' is'} armed for download from{' '}
              <span className={sourceMeta.accentText}>{sourceMeta.label}</span>.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="ghost"
              onClick={onClear}
              className="justify-center rounded-2xl border border-white/10 bg-transparent text-ink-300 hover:bg-white/5 hover:text-white"
            >
              Clear batch
            </Button>
            <Button
              onClick={onDownload}
              loading={downloadLoading}
              className="justify-center !bg-accent-600 !text-white hover:!bg-accent-500"
            >
              <Download className="h-4 w-4" />
              Queue download
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChapterBayRow({
  chapter,
  selected,
  onToggle,
}: {
  chapter: MangaChapterDto
  selected: boolean
  onToggle: () => void
}) {
  const updatedLabel = formatChapterUpdate(chapter.updatedAt)

  return (
    <button
      onClick={onToggle}
      className={clsx(
        'group w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-150',
        selected
          ? 'border-white/15 bg-white/[0.09]'
          : 'border-white/10 bg-black/20 hover:bg-white/[0.06]',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
            selected
              ? 'border-white bg-white text-ink-950'
              : 'border-white/15 bg-transparent text-transparent group-hover:border-white/25',
          )}
        >
          <Check className="h-3 w-3" />
        </div>

        <span className="w-14 shrink-0 font-mono text-sm font-semibold text-ink-100">
          {chapter.chapterNumber}
        </span>

        <span className="min-w-0 flex-1 truncate text-sm text-ink-300">
          {chapter.title || `Chapter ${chapter.chapterNumber}`}
        </span>

        <div className="flex shrink-0 items-center gap-2 text-[11px] text-ink-500">
          {chapter.volumeNumber && <span>Vol.{chapter.volumeNumber}</span>}
          {chapter.language && <Flag code={chapter.language} />}
          {chapter.pageCount != null && <span>{chapter.pageCount}p</span>}
          {chapter.scanlator && <span className="hidden sm:inline truncate max-w-[120px]">{chapter.scanlator}</span>}
          {updatedLabel && <span className="hidden md:inline">{updatedLabel}</span>}
        </div>
      </div>
    </button>
  )
}

function MangaDetailSkeleton() {
  return (
    <div className="animate-page-in space-y-8 pb-28">
      <Skeleton className="h-10 w-40 rounded-full" />

      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-ink-950 p-5 sm:p-8">
        <div className="grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)]">
          <Skeleton className="aspect-[2/3] w-full rounded-[28px]" />
          <div className="space-y-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-14 w-3/4" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-2/3" />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-28 rounded-[24px]" />
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Skeleton className="h-48 rounded-[28px]" />
              <Skeleton className="h-48 rounded-[28px]" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Skeleton className="h-[420px] rounded-[28px]" />
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-[24px]" />
          ))}
        </div>
      </div>
    </div>
  )
}
