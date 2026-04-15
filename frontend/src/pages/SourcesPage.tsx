import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  BookOpen,
  ChevronDown,
  Command,
  Filter,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  X,
} from 'lucide-react'
import { api, imageProxyUrl } from '@/api/client'
import type {
  HealthStatus,
  MangaSearchResultDto,
  MangaSourceId,
} from '@/api/sources'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'
import { MangaDetailPanel } from '@/components/MangaDetailPanel'
import { Flag } from '@/components/Flag'
import { SourceIcon } from '@/components/SourceIcon'
import { SOURCE_BRAND, langLabel } from '@/lib/brand'

// Pool of currently popular / frequently searched manga — rotated on each mount
const TRENDING_POOL = [
  'One Piece', 'Jujutsu Kaisen', 'Chainsaw Man', 'Solo Leveling', 'Dandadan',
  'Kagurabachi', 'Berserk', 'Blue Lock', 'Kaiju No. 8', 'Sakamoto Days',
  'Frieren', 'Oshi no Ko', 'My Hero Academia', 'Vagabond', 'Vinland Saga',
  'Spy x Family', 'Attack on Titan', 'Tokyo Revengers', 'Hunter x Hunter',
  'The Beginning After The End', 'Wind Breaker', 'Record of Ragnarok',
]

function pickTrending(count: number): string[] {
  const pool = [...TRENDING_POOL]
  const out: string[] = []
  while (out.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length)
    out.push(pool.splice(idx, 1)[0]!)
  }
  return out
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)

const HEALTH_META: Record<
  HealthStatus,
  { label: string; dot: string; pill: string; note: string }
> = {
  GREEN: {
    label: 'Stable',
    dot: 'bg-emerald-400',
    pill: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20',
    note: 'Healthy and responsive',
  },
  YELLOW: {
    label: 'Watch',
    dot: 'bg-amber-400',
    pill: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20',
    note: 'Slow or partially degraded',
  },
  RED: {
    label: 'Down',
    dot: 'bg-red-400',
    pill: 'bg-red-500/10 text-red-300 ring-1 ring-red-500/20',
    note: 'Unavailable or failing',
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

const EMPTY_SOURCE_LIST: Array<{ sourceId: MangaSourceId; languages: string[] }> = []

function formatLatency(latencyMs: number | null | undefined) {
  if (latencyMs == null) return 'pending'
  if (latencyMs >= 1000) return `${(latencyMs / 1000).toFixed(1)} s`
  return `${latencyMs} ms`
}

function statusWeight(status: MangaSearchResultDto['status']) {
  switch (status) {
    case 'ONGOING':
      return 4
    case 'HIATUS':
      return 3
    case 'COMPLETED':
      return 2
    case 'CANCELLED':
      return 1
    default:
      return 0
  }
}

function compareSearchResults(left: MangaSearchResultDto, right: MangaSearchResultDto) {
  const coverDelta = Number(Boolean(right.coverUrl)) - Number(Boolean(left.coverUrl))
  if (coverDelta !== 0) return coverDelta

  const statusDelta = statusWeight(right.status) - statusWeight(left.status)
  if (statusDelta !== 0) return statusDelta

  return left.title.localeCompare(right.title)
}

function normalizeTitleKey(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function collectTitleKeys(result: MangaSearchResultDto) {
  return Array.from(
    new Set(
      [result.title, ...(result.alternativeTitles ?? [])]
        .map((value) => normalizeTitleKey(value))
        .filter(Boolean),
    ),
  )
}

interface DirectoryEntry {
  key: string
  lead: MangaSearchResultDto
  variants: MangaSearchResultDto[]
  sourceCount: number
  primaryAltTitle?: string
}

function buildDirectoryEntries(results: MangaSearchResultDto[]) {
  const groups: Array<{ keys: Set<string>; items: MangaSearchResultDto[] }> = []

  for (const result of results) {
    const keys = collectTitleKeys(result)
    const matches = groups.filter((group) => keys.some((key) => group.keys.has(key)))

    if (matches.length === 0) {
      groups.push({
        keys: new Set(keys),
        items: [result],
      })
      continue
    }

    const target = matches[0]!
    const rest = matches.slice(1)
    target.items.push(result)
    keys.forEach((key) => target.keys.add(key))

    for (const duplicate of rest) {
      duplicate.items.forEach((item) => target.items.push(item))
      duplicate.keys.forEach((key) => target.keys.add(key))
      const duplicateIndex = groups.indexOf(duplicate)
      if (duplicateIndex >= 0) groups.splice(duplicateIndex, 1)
    }
  }

  return groups
    .map<DirectoryEntry>((group) => {
      const dedupedVariants = group.items.reduce<MangaSearchResultDto[]>((acc, item) => {
        if (acc.some((existing) => existing.sourceId === item.sourceId && existing.id === item.id)) {
          return acc
        }
        acc.push(item)
        return acc
      }, [])

      dedupedVariants.sort(compareSearchResults)

      const lead = dedupedVariants[0]!
      const primaryAltTitle = dedupedVariants
        .flatMap((item) => item.alternativeTitles ?? [])
        .find((title) => normalizeTitleKey(title) !== normalizeTitleKey(lead.title))

      return {
        key: group.keys.values().next().value ?? `${lead.sourceId}-${lead.id}`,
        lead,
        variants: dedupedVariants,
        sourceCount: new Set(dedupedVariants.map((item) => item.sourceId)).size,
        primaryAltTitle,
      }
    })
    .sort((left, right) => {
      const sourceDelta = right.sourceCount - left.sourceCount
      if (sourceDelta !== 0) return sourceDelta
      return compareSearchResults(left.lead, right.lead)
    })
}

export function SourcesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [enabledSources, setEnabledSources] = useState<Set<MangaSourceId>>(new Set())
  const [langFilter, setLangFilter] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [trendingPicks, setTrendingPicks] = useState<string[]>(() => pickTrending(5))

  // Rotate trending picks every 20 seconds while idle
  useEffect(() => {
    const id = window.setInterval(() => {
      setTrendingPicks(pickTrending(5))
    }, 20000)
    return () => window.clearInterval(id)
  }, [])
  const [selectedManga, setSelectedManga] = useState<{
    sourceId: MangaSourceId
    mangaId: string
    title: string
    coverUrl?: string | null
    language?: string | null
  } | null>(null)

  // Wire the browser back button to close the detail panel instead of
  // unmounting the whole page. Push a history entry on open; on popstate
  // while a manga is selected, close it and stay on Browse Sources.
  useEffect(() => {
    if (!selectedManga) return
    window.history.pushState({ kometaDetail: true }, '')
    const onPop = () => setSelectedManga(null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [selectedManga])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const sourcesQuery = useQuery({
    queryKey: ['manga-sources'],
    queryFn: api.getSources,
  })

  const healthQuery = useQuery({
    queryKey: ['manga-sources-health'],
    queryFn: api.getSourcesHealth,
    refetchInterval: 60_000,
  })

  const refreshHealthMutation = useMutation({
    mutationFn: api.refreshSourcesHealth,
    onSuccess: (data) => {
      queryClient.setQueryData(['manga-sources-health'], data)
      toast('Source health refreshed', 'success')
    },
    onError: (error: Error) => {
      toast(error.message || 'Unable to refresh source health', 'error')
    },
  })

  const downloadMutation = useMutation({
    mutationFn: api.downloadChapters,
    onSuccess: (items) => {
      toast(
        `Queued ${items.length} chapter${items.length !== 1 ? 's' : ''} for download`,
        'success',
      )
      queryClient.invalidateQueries({ queryKey: ['download-queue'] })
      queryClient.invalidateQueries({ queryKey: ['download-status'] })
    },
    onError: (error: Error) => {
      toast(error.message || 'Failed to queue downloads', 'error')
    },
  })

  const sources = sourcesQuery.data ?? EMPTY_SOURCE_LIST

  const availableLanguages = useMemo(() => {
    const languages = new Set<string>()
    for (const source of sources) {
      for (const language of source.languages) languages.add(language)
    }

    return Array.from(languages).sort((left, right) => {
      if (left === 'en') return -1
      if (right === 'en') return 1
      if (left === 'it') return -1
      if (right === 'it') return 1
      return left.localeCompare(right)
    })
  }, [sources])

  const filteredSources = useMemo(() => {
    if (!langFilter) return sources
    return sources.filter((source) => source.languages.includes(langFilter))
  }, [langFilter, sources])

  useEffect(() => {
    setEnabledSources((previous) => {
      const filteredIds = new Set(filteredSources.map((source) => source.sourceId))
      const retained = new Set(
        Array.from(previous).filter((sourceId) => filteredIds.has(sourceId)),
      )

      if (retained.size > 0) return retained
      if (filteredIds.size > 0) return filteredIds
      return previous
    })
  }, [filteredSources])

  useEffect(() => {
    const trimmed = query.trim()
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (trimmed.length < 2) {
      setSearchTerm('')
      return
    }

    debounceRef.current = setTimeout(() => setSearchTerm(trimmed), 320)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const activeSourceIds = useMemo(
    () =>
      filteredSources
        .filter((source) => enabledSources.has(source.sourceId))
        .map((source) => source.sourceId),
    [enabledSources, filteredSources],
  )

  const searchQueries = useQueries({
    queries: activeSourceIds.map((sourceId) => ({
      queryKey: ['manga-search', sourceId, searchTerm, langFilter],
      queryFn: () => api.searchSource(sourceId, searchTerm, 20, langFilter),
      enabled: searchTerm.length >= 2,
      retry: 1,
      staleTime: 30_000,
    })),
  })

  const healthMap = useMemo(() => {
    const map = new Map<
      MangaSourceId,
      { status: HealthStatus; latencyMs: number | null; error: string | null }
    >()

    for (const item of healthQuery.data ?? []) {
      map.set(item.sourceId, {
        status: item.status,
        latencyMs: item.latencyMs,
        error: item.error,
      })
    }
    return map
  }, [healthQuery.data])

  const resultCountBySource = useMemo(() => {
    const map = new Map<MangaSourceId, number>()
    activeSourceIds.forEach((sourceId, index) => {
      map.set(sourceId, searchQueries[index]?.data?.length ?? 0)
    })
    return map
  }, [activeSourceIds, searchQueries])

  const { mergedResults, loadingCount, errorCount, totalCount } = useMemo(() => {
    const all: MangaSearchResultDto[] = []
    let loading = 0
    let errors = 0

    for (const queryState of searchQueries) {
      if (queryState.isLoading) loading += 1
      if (queryState.isError) errors += 1
      if (queryState.data) all.push(...queryState.data)
    }

    const ranked = [...all].sort(compareSearchResults)

    return {
      mergedResults: ranked,
      loadingCount: loading,
      errorCount: errors,
      totalCount: ranked.length,
    }
  }, [searchQueries])

  const healthSummary = useMemo(() => {
    let green = 0
    let yellow = 0
    let red = 0

    for (const health of healthQuery.data ?? []) {
      if (health.status === 'GREEN') green += 1
      if (health.status === 'YELLOW') yellow += 1
      if (health.status === 'RED') red += 1
    }

    return { green, yellow, red }
  }, [healthQuery.data])

  const sourceDeck = useMemo(() => {
    return [...filteredSources].sort((left, right) => {
      const leftActive = enabledSources.has(left.sourceId) ? 1 : 0
      const rightActive = enabledSources.has(right.sourceId) ? 1 : 0
      if (leftActive !== rightActive) return rightActive - leftActive
      return SOURCE_BRAND[left.sourceId].label.localeCompare(
        SOURCE_BRAND[right.sourceId].label,
      )
    })
  }, [enabledSources, filteredSources])

  const directoryEntries = useMemo(
    () => buildDirectoryEntries(mergedResults),
    [mergedResults],
  )

  const isSearching = searchTerm.length >= 2
  const anyLoading = loadingCount > 0
  const activeLanguageLabel = langFilter
    ? langLabel(langFilter)
    : 'All languages'
  const hasActiveSources = activeSourceIds.length > 0
  const totalDirectoryMatches = directoryEntries.length

  const handleSearch = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      const trimmed = query.trim()
      if (trimmed.length >= 2) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        setSearchTerm(trimmed)
      }
    },
    [query],
  )

  const handleSuggestedQuery = useCallback((suggestion: string) => {
    setQuery(suggestion)
    setSearchTerm(suggestion)
    inputRef.current?.focus()
  }, [])

  const handleClearSearch = useCallback(() => {
    setQuery('')
    setSearchTerm('')
    inputRef.current?.focus()
  }, [])

  const toggleSource = useCallback((sourceId: MangaSourceId) => {
    setEnabledSources((previous) => {
      const next = new Set(previous)
      if (next.has(sourceId)) next.delete(sourceId)
      else next.add(sourceId)
      return next
    })
  }, [])

  const enableAllSources = useCallback(() => {
    setEnabledSources(new Set(filteredSources.map((source) => source.sourceId)))
  }, [filteredSources])

  const enableHealthySources = useCallback(() => {
    const healthy = filteredSources
      .filter((source) => healthMap.get(source.sourceId)?.status !== 'RED')
      .map((source) => source.sourceId)

    const fallback = filteredSources.map((source) => source.sourceId)
    setEnabledSources(new Set(healthy.length > 0 ? healthy : fallback))
  }, [filteredSources, healthMap])

  const handleMangaClick = useCallback(
    (result: MangaSearchResultDto) => {
      startTransition(() => {
        setSelectedManga({
          sourceId: result.sourceId,
          mangaId: result.id,
          title: result.title,
          coverUrl: result.coverUrl,
          language: langFilter,
        })
      })
    },
    [langFilter],
  )

  if (selectedManga) {
    return (
      <MangaDetailPanel
        sourceId={selectedManga.sourceId}
        mangaId={selectedManga.mangaId}
        initialTitle={selectedManga.title}
        initialCoverUrl={selectedManga.coverUrl}
        initialLanguage={selectedManga.language}
        onBack={() => {
          // Prefer the browser history so back-button state stays consistent
          if (window.history.state?.kometaDetail) window.history.back()
          else setSelectedManga(null)
        }}
        onDownload={(sourceId, mangaId, chapterIds) => {
          downloadMutation.mutate({ sourceId, mangaId, chapterIds })
        }}
        downloadLoading={downloadMutation.isPending}
      />
    )
  }

  if (sourcesQuery.isLoading && sources.length === 0) {
    return <SourcesPageSkeleton />
  }

  if (sourcesQuery.isError && sources.length === 0) {
    return (
      <div className="animate-fade-in">
        <ErrorState
          message="Unable to load manga sources"
          hint="The source registry did not answer. Retry when the backend is back on station."
          onRetry={() => sourcesQuery.refetch()}
        />
      </div>
    )
  }

  return (
    <div className="animate-fade-in font-jpSans space-y-4 pb-12">
      <div aria-live="polite" className="sr-only">
        {isSearching
          ? `${totalDirectoryMatches} grouped matches across ${activeSourceIds.length} active sources`
          : `${filteredSources.length} sources ready to search`}
      </div>

      {/* ── Command Bar ── */}
      <section className="mx-auto max-w-2xl pt-6 pb-2">
        <h1 className="text-center font-display text-lg font-medium tracking-tight text-ink-300">
          Browse Sources
        </h1>

        <form onSubmit={handleSearch} className="mt-4">
          <div
            className={clsx(
              'flex items-center gap-3 rounded-2xl border bg-ink-950/80 px-4 py-3.5 shadow-card transition-all duration-200',
              'border-ink-800/50 focus-within:border-ink-600/60 focus-within:shadow-card-hover focus-within:ring-1 focus-within:ring-ink-700/30',
            )}
          >
            {anyLoading ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent-400" />
            ) : (
              <Search className="h-5 w-5 shrink-0 text-ink-500" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search manga across all sources..."
              className="min-w-0 flex-1 bg-transparent text-base text-ink-100 placeholder:text-ink-600 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="rounded-full p-1 text-ink-500 transition-colors hover:bg-white/5 hover:text-ink-200"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <kbd className="hidden items-center gap-0.5 rounded-md border border-ink-800/50 bg-ink-900/60 px-1.5 py-0.5 font-mono text-[10px] text-ink-600 sm:inline-flex">
              {isMac ? <><Command className="h-2.5 w-2.5" />K</> : 'Ctrl+K'}
            </kbd>
          </div>
        </form>

        {!isSearching && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="font-opsMono text-[10px] uppercase tracking-[0.2em] text-ink-600">Most researched</span>
            {trendingPicks.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSuggestedQuery(s)}
                className="rounded-full border border-ink-800/50 bg-ink-900/40 px-3 py-1 text-xs text-ink-400 transition-colors hover:bg-ink-800/60 hover:text-ink-200"
              >
                {s}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTrendingPicks(pickTrending(5))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-ink-800/60 hover:text-ink-200"
              title="Refresh suggestions"
              aria-label="Refresh suggestions"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        )}

        {isSearching && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-500">
            <span>{activeSourceIds.length} source{activeSourceIds.length !== 1 ? 's' : ''} active</span>
            <span className="h-1 w-1 rounded-full bg-ink-700" />
            <span>{totalDirectoryMatches} result{totalDirectoryMatches !== 1 ? 's' : ''}</span>
            <span className="h-1 w-1 rounded-full bg-ink-700" />
            <span>{activeLanguageLabel}</span>
            {anyLoading && (
              <>
                <span className="h-1 w-1 rounded-full bg-ink-700" />
                <span className="text-accent-400">{loadingCount} loading...</span>
              </>
            )}
          </div>
        )}
      </section>

      {/* ── Filter Strip ── */}
      <section className="mx-auto max-w-5xl">
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="group flex flex-1 items-center justify-between rounded-xl border border-ink-800/40 bg-ink-900/40 px-4 py-2.5 text-left transition-colors hover:bg-ink-900/60"
        >
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-ink-500" />
            <span className="text-sm font-medium text-ink-300">Filters</span>
            <div className="flex items-center gap-1.5">
              {healthSummary.green > 0 && (
                <span className="h-2 w-2 rounded-full bg-emerald-400" title={`${healthSummary.green} stable`} />
              )}
              {healthSummary.yellow > 0 && (
                <span className="h-2 w-2 rounded-full bg-amber-400" title={`${healthSummary.yellow} degraded`} />
              )}
              {healthSummary.red > 0 && (
                <span className="h-2 w-2 rounded-full bg-red-400" title={`${healthSummary.red} down`} />
              )}
              <span className="ml-1 text-xs text-ink-500">
                {activeSourceIds.length}/{filteredSources.length} sources
              </span>
              {langFilter && (
                <span className="rounded-full bg-accent-600/15 px-2 py-0.5 text-[10px] text-accent-300">
                  {activeLanguageLabel}
                </span>
              )}
            </div>
          </div>
          <ChevronDown
            className={clsx(
              'h-4 w-4 text-ink-500 transition-transform duration-200',
              filtersOpen && 'rotate-180',
            )}
          />
        </button>
        <Link
          to="/settings/sources"
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-ink-800/40 bg-ink-900/40 text-ink-400 transition-colors hover:bg-ink-900/60 hover:text-ink-200"
          title="Source settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
        </div>

        {filtersOpen && (
          <div className="mt-2 animate-slide-up space-y-4 rounded-xl border border-ink-800/40 bg-ink-900/40 p-4">
            {/* Sources */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-opsMono text-[10px] uppercase tracking-[0.2em] text-ink-500">Sources</span>
                <div className="flex gap-3">
                  <button type="button" onClick={enableAllSources} className="text-[11px] text-ink-400 transition-colors hover:text-ink-200">
                    All
                  </button>
                  <button type="button" onClick={enableHealthySources} className="text-[11px] text-ink-400 transition-colors hover:text-ink-200">
                    Healthy only
                  </button>
                  <button
                    type="button"
                    onClick={() => refreshHealthMutation.mutate()}
                    className="flex items-center gap-1 text-[11px] text-ink-400 transition-colors hover:text-ink-200"
                  >
                    <RefreshCw className={clsx('h-3 w-3', refreshHealthMutation.isPending && 'animate-spin')} />
                    Refresh
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {sourceDeck.map((source) => {
                  const meta = SOURCE_BRAND[source.sourceId]
                  const active = enabledSources.has(source.sourceId)
                  const health = healthMap.get(source.sourceId)
                  return (
                    <button
                      key={source.sourceId}
                      type="button"
                      onClick={() => toggleSource(source.sourceId)}
                      className={clsx(
                        'flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-150',
                        active
                          ? 'bg-ink-800/80 text-ink-100 ring-1 ring-ink-700/50'
                          : 'bg-ink-950/50 text-ink-500 hover:bg-ink-900/60 hover:text-ink-300',
                      )}
                    >
                      <SourceIcon sourceId={source.sourceId} size={14} />
                      {meta.label}
                      {health && <span className={clsx('h-1.5 w-1.5 rounded-full', HEALTH_META[health.status].dot)} />}
                      {isSearching && (
                        <span className="font-opsMono text-[10px] text-ink-500">
                          {resultCountBySource.get(source.sourceId) ?? 0}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Languages */}
            <div>
              <span className="mb-2 block font-opsMono text-[10px] uppercase tracking-[0.2em] text-ink-500">Language</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setLangFilter(null)}
                  className={clsx(
                    'rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                    !langFilter ? 'bg-accent-600/15 text-accent-300' : 'text-ink-400 hover:text-ink-200',
                  )}
                >
                  All
                </button>
                {availableLanguages.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLangFilter((current) => (current === lang ? null : lang))}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                      langFilter === lang ? 'bg-accent-600/15 text-accent-300' : 'text-ink-400 hover:text-ink-200',
                    )}
                  >
                    <Flag code={lang} />
                    {langLabel(lang)}
                  </button>
                ))}
              </div>
            </div>

            {/* Health summary */}
            <div className="flex items-center gap-4 border-t border-ink-800/30 pt-3 text-xs text-ink-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {healthSummary.green} stable
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                {healthSummary.yellow} watch
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                {healthSummary.red} down
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── Results Area ── */}
      <section className="mx-auto max-w-6xl">
        {/* Landing */}
        {!isSearching && (
          <div className="animate-fade-in">
            <div className="flex flex-col items-center py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-800/40 text-ink-400">
                <BookOpen className="h-7 w-7" />
              </div>
              <h2 className="mt-4 font-display text-xl font-semibold text-ink-200">
                Search across {filteredSources.length} sources at once
              </h2>
              <p className="mt-2 max-w-md text-sm text-ink-500">
                Type a manga title above. Results from all active sources are merged, deduplicated, and ranked automatically.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sourceDeck.map((source) => (
                <SourceLandingCard key={source.sourceId} source={source} health={healthMap.get(source.sourceId)} />
              ))}
            </div>
          </div>
        )}

        {/* No sources selected */}
        {isSearching && !hasActiveSources && (
          <div role="alert">
            <ErrorState
              message="No source selected"
              hint="Open filters and enable at least one source before searching."
            />
          </div>
        )}

        {/* Loading */}
        {isSearching && anyLoading && totalCount === 0 && hasActiveSources && <DirectoryLoadingState />}

        {/* Errors */}
        {isSearching && !anyLoading && errorCount > 0 && totalCount === 0 && hasActiveSources && (
          <div role="alert">
            <ErrorState
              message={`Search failed on ${errorCount} source${errorCount !== 1 ? 's' : ''}`}
              hint="Try refreshing source health, widening the language filter, or reducing active sources."
              onRetry={() => queryClient.invalidateQueries({ queryKey: ['manga-search'] })}
            />
          </div>
        )}

        {/* No results */}
        {isSearching && !anyLoading && totalCount === 0 && errorCount === 0 && hasActiveSources && (
          <DirectoryNoResults searchTerm={searchTerm} onSuggestionClick={handleSuggestedQuery} suggestions={trendingPicks} />
        )}

        {/* Results grid */}
        {isSearching && totalCount > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3 px-1">
              <h2 className="font-display text-lg font-semibold text-ink-100">
                {totalDirectoryMatches} result{totalDirectoryMatches !== 1 ? 's' : ''}
                <span className="ml-2 font-normal text-ink-500">for &ldquo;{searchTerm}&rdquo;</span>
              </h2>
              <div className="flex items-center gap-3 text-xs text-ink-500">
                <span>{totalCount} raw hits</span>
                <span>{activeSourceIds.length} sources</span>
                {errorCount > 0 && <span className="text-red-400">{errorCount} failed</span>}
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {directoryEntries.map((entry) => (
                <MangaShelfCard
                  key={entry.key}
                  entry={entry}
                  onOpenLead={() => handleMangaClick(entry.lead)}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

/* ── Sub-components ── */

function SourceLandingCard({
  source,
  health,
}: {
  source: { sourceId: MangaSourceId; languages: string[] }
  health?: { status: HealthStatus; latencyMs: number | null; error: string | null }
}) {
  const meta = SOURCE_BRAND[source.sourceId]
  const healthMeta = health ? HEALTH_META[health.status] : null

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-ink-800/40 bg-ink-900/40 p-4 transition-colors hover:bg-ink-900/60">
      <SourceIcon sourceId={source.sourceId} size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink-200">{meta.label}</span>
          {healthMeta && <span className={clsx('h-2 w-2 rounded-full', healthMeta.dot)} />}
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-ink-500">{meta.blurb}</p>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-600">
          <span>{source.languages.length} lang</span>
          <span>{formatLatency(health?.latencyMs)}</span>
        </div>
      </div>
    </div>
  )
}

function MangaShelfCard({
  entry,
  onOpenLead,
}: {
  entry: DirectoryEntry
  onOpenLead: () => void
}) {
  const { lead } = entry
  const meta = SOURCE_BRAND[lead.sourceId]

  return (
    <div className="group animate-fade-in">
      <button type="button" onClick={onOpenLead} className="relative w-full overflow-hidden rounded-xl bg-ink-900/60 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
        {/* Cover */}
        <div className="aspect-[2/3] w-full overflow-hidden bg-ink-950/80">
          {lead.coverUrl ? (
            <img
              src={imageProxyUrl(lead.coverUrl) ?? lead.coverUrl}
              alt={lead.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-ink-700">
              <BookOpen className="h-8 w-8" />
            </div>
          )}

          {/* Source count overlay (top-right) */}
          {entry.sourceCount > 1 && (
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-ink-950/80 px-2 py-1 text-[10px] font-medium text-ink-200 backdrop-blur-sm">
              <Layers className="h-3 w-3" />
              {entry.sourceCount}
            </div>
          )}
        </div>

        {/* Title area */}
        <div className="p-3 text-left">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-ink-100 group-hover:text-white">
            {lead.title}
          </h3>
          {entry.primaryAltTitle && (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-500">{entry.primaryAltTitle}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <SourceIcon sourceId={lead.sourceId} size={12} />
            <span className="text-[11px] text-ink-500">{meta.label}</span>
            {lead.status && lead.status !== 'UNKNOWN' && (
              <span
                className={clsx(
                  'rounded px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider',
                  STATUS_META[lead.status],
                )}
              >
                {lead.status}
              </span>
            )}
            {lead.year && <span className="ml-auto text-[11px] text-ink-600">{lead.year}</span>}
          </div>
        </div>
      </button>
    </div>
  )
}

function DirectoryLoadingState() {
  return (
    <div className="mx-auto max-w-6xl">
      <Skeleton className="mb-4 h-6 w-48" />
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[2/3] w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

function DirectoryNoResults({
  searchTerm,
  onSuggestionClick,
  suggestions,
}: {
  searchTerm: string
  onSuggestionClick: (value: string) => void
  suggestions: string[]
}) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-ink-800/50 bg-ink-900/20 text-center animate-fade-in">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-800/40 text-ink-500">
        <Search className="h-6 w-6" />
      </div>
      <div className="max-w-xs">
        <p className="font-display font-semibold text-ink-300">No results for &ldquo;{searchTerm}&rdquo;</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
          Try a different title, remove language filters, or enable more sources.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <Button key={s} variant="ghost" size="sm" onClick={() => onSuggestionClick(s)}>
            {s}
          </Button>
        ))}
      </div>
    </div>
  )
}

function SourcesPageSkeleton() {
  return (
    <div className="animate-fade-in space-y-6 pb-12">
      <div className="mx-auto max-w-2xl space-y-4 pt-6">
        <Skeleton className="mx-auto h-5 w-32" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
      <div className="mx-auto max-w-5xl">
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
      <div className="mx-auto max-w-5xl grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
