import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  Heart,
  HeartOff,
  Languages,
  Search,
  Sparkles,
  User,
} from 'lucide-react'
import { api, imageProxyUrl } from '@/api/client'
import type { MangaChapterDto, MangaSourceId } from '@/api/sources'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'

interface MangaDetailPanelProps {
  sourceId: MangaSourceId
  mangaId: string
  initialTitle: string
  initialCoverUrl?: string | null
  initialLanguage?: string | null
  onBack: () => void
  onDownload: (sourceId: MangaSourceId, mangaId: string, chapterIds: string[]) => void
  downloadLoading?: boolean
}

const SOURCE_META: Record<
  MangaSourceId,
  {
    label: string
    accentDot: string
    accentSoft: string
    accentText: string
    accentGlow: string
    accentRing: string
  }
> = {
  MANGADEX: {
    label: 'MangaDex',
    accentDot: 'bg-orange-400',
    accentSoft: 'bg-orange-500/10 text-orange-200',
    accentText: 'text-orange-300',
    accentGlow: 'from-orange-500/18 via-orange-500/5 to-transparent',
    accentRing: 'ring-orange-500/20 border-orange-500/20',
  },
  COMICK: {
    label: 'Comick',
    accentDot: 'bg-rose-400',
    accentSoft: 'bg-rose-500/10 text-rose-200',
    accentText: 'text-rose-300',
    accentGlow: 'from-rose-500/18 via-rose-500/5 to-transparent',
    accentRing: 'ring-rose-500/20 border-rose-500/20',
  },
  MANGAWORLD: {
    label: 'MangaWorld',
    accentDot: 'bg-emerald-400',
    accentSoft: 'bg-emerald-500/10 text-emerald-200',
    accentText: 'text-emerald-300',
    accentGlow: 'from-emerald-500/18 via-emerald-500/5 to-transparent',
    accentRing: 'ring-emerald-500/20 border-emerald-500/20',
  },
  NINEMANGA: {
    label: 'WeebCentral',
    accentDot: 'bg-cyan-400',
    accentSoft: 'bg-cyan-500/10 text-cyan-200',
    accentText: 'text-cyan-300',
    accentGlow: 'from-cyan-500/18 via-cyan-500/5 to-transparent',
    accentRing: 'ring-cyan-500/20 border-cyan-500/20',
  },
  MANGAPILL: {
    label: 'Mangapill',
    accentDot: 'bg-pink-400',
    accentSoft: 'bg-pink-500/10 text-pink-200',
    accentText: 'text-pink-300',
    accentGlow: 'from-pink-500/18 via-pink-500/5 to-transparent',
    accentRing: 'ring-pink-500/20 border-pink-500/20',
  },
  MANGAFIRE: {
    label: 'MangaFire',
    accentDot: 'bg-amber-400',
    accentSoft: 'bg-amber-500/10 text-amber-200',
    accentText: 'text-amber-300',
    accentGlow: 'from-amber-500/18 via-amber-500/5 to-transparent',
    accentRing: 'ring-amber-500/20 border-amber-500/20',
  },
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

type SourceMetaEntry = (typeof SOURCE_META)[MangaSourceId]

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
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const sourceMeta = SOURCE_META[sourceId]

  const detailsQuery = useQuery({
    queryKey: ['manga-details', sourceId, mangaId],
    queryFn: () => api.getMangaDetails(sourceId, mangaId),
  })

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
    mutationFn: () => api.deleteAutoDownloaderRule(existingRule!.id),
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
    onDownload(sourceId, mangaId, Array.from(selectedChapters))
    setSelectedChapters(new Set())
  }, [mangaId, onDownload, selectedChapters, sourceId])

  const selectedCount = selectedChapters.size
  const chapterCount = sortedChapters.length
  const activeLanguageLabel = languageFilter ? languageFilter.toUpperCase() : 'ALL'
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
        onClose={() => setShowFollowDialog(false)}
        onConfirm={() => followMutation.mutate()}
      />

      <DetailHero
        sourceMeta={sourceMeta}
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
          chapterCount={chapterCount}
          selectedCount={selectedCount}
          loading={chaptersQuery.isLoading && chapterCount === 0}
          error={chaptersQuery.isError}
          onRetry={() => chaptersQuery.refetch()}
          chapters={sortedChapters}
          selectedChapters={selectedChapters}
          onToggleChapter={toggleChapter}
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
  onClose,
  onConfirm,
}: {
  open: boolean
  sourceMeta: SourceMetaEntry
  title: string
  activeLanguageLabel: string
  loading: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/10 bg-[#070b16] shadow-[0_32px_120px_rgba(0,0,0,0.55)]"
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
                <h3 className="font-display text-2xl font-semibold tracking-tight text-white">
                  Follow this manga?
                </h3>
                <p className="mt-2 max-w-md text-sm leading-7 text-ink-300">
                  We&apos;ll create an auto-downloader rule for{' '}
                  <span className="font-semibold text-white">{title}</span> so future chapters can
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

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
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
}: {
  sourceMeta: SourceMetaEntry
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
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#070b16] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_32px_120px_rgba(0,0,0,0.45)]">
      <div className={clsx('absolute inset-0 bg-gradient-to-br opacity-100', sourceMeta.accentGlow)} />
      <div className="absolute inset-y-0 left-0 w-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_42%)]" />
      <div className="relative p-5 sm:p-8 xl:p-10">
        <div className="grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-ink-950/70 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
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
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                      <Sparkles className="h-7 w-7 text-white/70" />
                    </div>
                    <div>
                      <p className="font-display text-lg font-semibold text-white">No cover signal</p>
                      <p className="mt-1 text-sm text-ink-400">
                        Metadata is still available for chapter triage.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-4">
                <div
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-mono uppercase tracking-[0.28em]',
                    sourceMeta.accentSoft,
                    sourceMeta.accentRing,
                  )}
                >
                  <span className={clsx('h-2 w-2 rounded-full', sourceMeta.accentDot)} />
                  {sourceMeta.label}
                </div>
                <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.28em] text-ink-300">
                  {activeLanguageLabel}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-500">
                  Discovery lane
                </p>
                <p className="mt-3 text-sm leading-7 text-ink-300">
                  Editorial overview on top, chapter operations underneath. This page is tuned for
                  quick triage, not generic browsing.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-500">
                  Auto-download
                </p>
                <p className="mt-3 text-sm leading-7 text-ink-300">
                  {isFollowing
                    ? `Following is active${followLanguage ? ` for ${followLanguage.toUpperCase()}` : ''}.`
                    : 'Not following yet. Enable it when you want future chapters to arrive automatically.'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.28em] text-ink-400">
                  <Activity className="h-3.5 w-3.5" />
                  Manga dossier
                </div>
                <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
                  {title}
                </h1>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={clsx('rounded-full px-3 py-1 text-xs font-semibold uppercase', STATUS_META[statusLabel])}>
                    {statusLabel.toLowerCase()}
                  </span>
                  {year && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-ink-300">
                      {year}
                    </span>
                  )}
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-ink-300">
                    {chapterCount} chapter{chapterCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {alternativeTitles.length > 0 && (
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-400">
                    Also known as {alternativeTitles.join(' • ')}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <Button
                  variant={isFollowing ? 'secondary' : 'primary'}
                  size="lg"
                  onClick={onToggleFollow}
                  loading={followLoading}
                  className={clsx(
                    'min-w-[180px] justify-center',
                    isFollowing
                      ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                      : 'bg-rose-500 text-white hover:bg-rose-400',
                  )}
                >
                  {isFollowing ? <HeartOff className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
                  {isFollowing ? 'Unfollow' : 'Follow manga'}
                </Button>
                <Button
                  size="lg"
                  onClick={onDownloadSelected}
                  disabled={selectedCount === 0}
                  loading={downloadLoading}
                  className="min-w-[180px] justify-center bg-white text-ink-950 hover:bg-ink-100"
                >
                  <Download className="h-4 w-4" />
                  Download selected
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <HeroMetric label="Source" value={sourceMeta.label} note="Active provider for this dossier" />
              <HeroMetric
                label="Selection"
                value={String(selectedCount)}
                note={selectedCount === 0 ? 'Pick chapters below' : 'Ready for queueing'}
              />
              <HeroMetric label="Language" value={activeLanguageLabel} note="Current chapter lane" />
              <HeroMetric
                label="Auto-follow"
                value={isFollowing ? 'ON' : 'OFF'}
                note={isFollowing ? 'New drops will be watched' : 'Manual queue only'}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 backdrop-blur-sm sm:p-6">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.28em] text-ink-500">
                  <Sparkles className="h-3.5 w-3.5" />
                  Synopsis
                </div>
                <p
                  className={clsx(
                    'mt-4 text-sm leading-8 text-ink-300',
                    !descExpanded && description && 'line-clamp-5',
                  )}
                >
                  {description || 'No summary came back from the source, but the chapter deck is fully available below.'}
                </p>
                {description.length > 280 && (
                  <button
                    onClick={onToggleDescription}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-ink-200 transition-colors hover:bg-white/10"
                  >
                    {descExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {descExpanded ? 'Collapse synopsis' : 'Expand synopsis'}
                  </button>
                )}
              </div>

              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 backdrop-blur-sm sm:p-6">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.28em] text-ink-500">
                  <User className="h-3.5 w-3.5" />
                  Metadata readout
                </div>
                <div className="mt-4 space-y-3">
                  <MetaRow
                    label="Authors"
                    value={authors.length ? authors.join(', ') : 'Unknown'}
                    icon={<User className="h-4 w-4" />}
                  />
                  <MetaRow
                    label="Artists"
                    value={artists.length ? artists.join(', ') : 'Unknown'}
                    icon={<Sparkles className="h-4 w-4" />}
                  />
                  <MetaRow
                    label="Language lane"
                    value={activeLanguageLabel}
                    icon={<Languages className="h-4 w-4" />}
                  />
                  <MetaRow
                    label="Queue posture"
                    value={
                      selectedCount === 0
                        ? 'Waiting for selection'
                        : `${selectedCount} chapter${selectedCount !== 1 ? 's' : ''} armed`
                    }
                    icon={<Download className="h-4 w-4" />}
                  />
                </div>
              </div>
            </div>

            {metadataPills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {metadataPills.map((pill) => (
                  <span
                    key={pill}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-ink-300"
                  >
                    {pill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-500">{label}</p>
      <p className="mt-3 font-display text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm text-ink-400">{note}</p>
    </div>
  )
}

function MetaRow({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[22px] border border-white/10 bg-ink-950/40 p-4">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-ink-300">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-500">{label}</p>
        <p className="mt-2 text-sm leading-7 text-ink-200">{value}</p>
      </div>
    </div>
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
      <Card className="rounded-[28px] border-white/10 bg-[#070b16]/90 p-0 shadow-[0_16px_60px_rgba(0,0,0,0.32)]">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.28em] text-ink-500">
            <Languages className="h-3.5 w-3.5" />
            Selection bay
          </div>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-white">
            Shape your download run
          </h2>
        </div>

        <div className="space-y-6 p-5">
          <div className="space-y-3">
            <QuickActionRow label="Selected now" value={`${selectedCount} chapter${selectedCount !== 1 ? 's' : ''}`} />
            <QuickActionRow label="Visible chapters" value={`${chapterCount}`} />
            <QuickActionRow label="Sort order" value={sortAsc ? 'Oldest to newest' : 'Newest to oldest'} />
            <QuickActionRow label="Follow state" value={isFollowing ? 'Watching future releases' : 'Manual mode'} />
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
                      'rounded-full border px-3 py-1.5 text-xs font-medium uppercase transition-colors',
                      languageFilter === language
                        ? 'border-white/15 bg-white text-ink-950'
                        : 'border-white/10 bg-white/5 text-ink-300 hover:bg-white/10',
                    )}
                  >
                    {language}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Button
              variant="secondary"
              onClick={onToggleSort}
              className="justify-between border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <span>{sortAsc ? 'Ascending order' : 'Descending order'}</span>
              {sortAsc ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="secondary"
              onClick={onSelectAll}
              disabled={chapterCount === 0}
              className="justify-center border-white/10 bg-white/5 text-white hover:bg-white/10"
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

      <Card className="rounded-[28px] border-white/10 bg-[#070b16]/90 p-0 shadow-[0_16px_60px_rgba(0,0,0,0.32)]">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.28em] text-ink-500">
            <Heart className="h-3.5 w-3.5" />
            Follow signal
          </div>
          <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-white">
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
                ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
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

function ChapterSection({
  sourceMeta,
  chapterCount,
  selectedCount,
  loading,
  error,
  onRetry,
  chapters,
  selectedChapters,
  onToggleChapter,
}: {
  sourceMeta: SourceMetaEntry
  chapterCount: number
  selectedCount: number
  loading: boolean
  error: boolean
  onRetry: () => void
  chapters: MangaChapterDto[]
  selectedChapters: Set<string>
  onToggleChapter: (chapterId: string) => void
}) {
  return (
    <Card className="relative overflow-hidden rounded-[28px] border-white/10 bg-[#070b16]/90 p-0 shadow-[0_16px_60px_rgba(0,0,0,0.32)]">
      <div className={clsx('absolute inset-0 bg-gradient-to-br opacity-100', sourceMeta.accentGlow)} />
      <div className="relative">
        <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.28em] text-ink-500">
              <Search className="h-3.5 w-3.5" />
              Chapter bay
            </div>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white">
              Browse the release deck
            </h2>
            <p className="mt-2 text-sm leading-7 text-ink-300">
              Select the exact chapters you want, scan the metadata, then send the batch to the
              queue.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-ink-300">
              {chapterCount} visible
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-ink-300">
              {selectedCount} selected
            </span>
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
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-black/20 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Search className="h-6 w-6 text-ink-400" />
              </div>
              <h3 className="mt-5 font-display text-2xl font-semibold text-white">
                No chapters in this lane
              </h3>
              <p className="mt-2 max-w-md text-sm leading-7 text-ink-400">
                Try another language filter or clear the current lane to see the full deck again.
              </p>
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
      <div className="mx-auto max-w-6xl rounded-[24px] border border-white/10 bg-[#060912]/90 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-500">
              Batch queue
            </p>
            <p className="mt-2 text-sm text-ink-300">
              <span className="font-semibold text-white">{selectedCount}</span> chapter
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
              className="justify-center bg-white text-ink-950 hover:bg-ink-100"
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
        'group w-full rounded-[24px] border p-4 text-left transition-all duration-200 sm:p-5',
        selected
          ? 'border-white/15 bg-white/[0.09] shadow-[0_18px_40px_rgba(0,0,0,0.22)]'
          : 'border-white/10 bg-black/20 hover:bg-white/[0.06]',
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex items-start gap-3">
          <div
            className={clsx(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors',
              selected
                ? 'border-white bg-white text-ink-950'
                : 'border-white/15 bg-transparent text-transparent group-hover:border-white/25',
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-ink-500">Chapter</p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">
              {chapter.chapterNumber}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {chapter.volumeNumber && (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-ink-300">
                Vol. {chapter.volumeNumber}
              </span>
            )}
            {chapter.language && (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase text-ink-300">
                {chapter.language}
              </span>
            )}
            {chapter.pageCount != null && (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-ink-300">
                {chapter.pageCount} pages
              </span>
            )}
          </div>

          <h3 className="mt-4 font-display text-xl font-semibold tracking-tight text-white">
            {chapter.title || `Chapter ${chapter.chapterNumber}`}
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-400">
            {chapter.scanlator && (
              <span className="inline-flex items-center gap-2">
                <User className="h-4 w-4" />
                {chapter.scanlator}
              </span>
            )}
            {updatedLabel && (
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                {updatedLabel}
              </span>
            )}
          </div>
        </div>

        <div
          className={clsx(
            'rounded-full border px-3 py-1 text-[11px] font-mono uppercase tracking-[0.24em]',
            selected
              ? 'border-white/15 bg-white text-ink-950'
              : 'border-white/10 bg-white/5 text-ink-400',
          )}
        >
          {selected ? 'Selected' : 'Ready'}
        </div>
      </div>
    </button>
  )
}

function MangaDetailSkeleton() {
  return (
    <div className="animate-page-in space-y-8 pb-28">
      <Skeleton className="h-10 w-40 rounded-full" />

      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[#070b16] p-5 sm:p-8">
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
