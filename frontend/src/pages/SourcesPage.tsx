import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  Activity,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Languages,
  Loader2,
  RefreshCcw,
  Search,
  X,
} from 'lucide-react'
import { api, imageProxyUrl } from '@/api/client'
import type {
  HealthStatus,
  MangaSearchResultDto,
  MangaSourceId,
} from '@/api/sources'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'
import { MangaDetailPanel } from '@/components/MangaDetailPanel'

const SEARCH_SUGGESTIONS = ['One Piece', 'Berserk', 'Blue Lock', 'Dandadan']

const SOURCE_META: Record<
  MangaSourceId,
  {
    label: string
    accentDot: string
    accentSoft: string
    blurb: string
  }
> = {
  MANGADEX: {
    label: 'MangaDex',
    accentDot: 'bg-orange-400',
    accentSoft: 'bg-orange-500/10 text-orange-200',
    blurb: 'Open catalog, clean metadata, reliable for deep discovery.',
  },
  COMICK: {
    label: 'Comick',
    accentDot: 'bg-rose-400',
    accentSoft: 'bg-rose-500/10 text-rose-200',
    blurb: 'Fast mirrors, broad catalog, strong scanlator variety.',
  },
  MANGAWORLD: {
    label: 'MangaWorld',
    accentDot: 'bg-emerald-400',
    accentSoft: 'bg-emerald-500/10 text-emerald-200',
    blurb: 'Italian-first comfort zone with dependable browsing rhythm.',
  },
  NINEMANGA: {
    label: 'WeebCentral',
    accentDot: 'bg-cyan-400',
    accentSoft: 'bg-cyan-500/10 text-cyan-200',
    blurb: 'Mirror-heavy fallback lane for broad chapter availability.',
  },
  MANGAPILL: {
    label: 'Mangapill',
    accentDot: 'bg-pink-400',
    accentSoft: 'bg-pink-500/10 text-pink-200',
    blurb: 'Direct and fast. Great when you want clean no-nonsense reads.',
  },
  MANGAFIRE: {
    label: 'MangaFire',
    accentDot: 'bg-amber-400',
    accentSoft: 'bg-amber-500/10 text-amber-200',
    blurb: 'Polished covers, broad genres, good visual browsing cadence.',
  },
}

const LANG_META: Record<string, { label: string; dot: string }> = {
  en: { label: 'English', dot: 'bg-sky-400' },
  it: { label: 'Italian', dot: 'bg-emerald-400' },
  ja: { label: 'Japanese', dot: 'bg-rose-400' },
  ko: { label: 'Korean', dot: 'bg-violet-400' },
  zh: { label: 'Chinese', dot: 'bg-amber-400' },
  'zh-hk': { label: 'Chinese HK', dot: 'bg-amber-300' },
  fr: { label: 'French', dot: 'bg-cyan-400' },
  es: { label: 'Spanish', dot: 'bg-orange-400' },
  'es-la': { label: 'Spanish LATAM', dot: 'bg-orange-300' },
  de: { label: 'German', dot: 'bg-yellow-400' },
  pt: { label: 'Portuguese', dot: 'bg-teal-400' },
  'pt-br': { label: 'Portuguese BR', dot: 'bg-teal-300' },
  ru: { label: 'Russian', dot: 'bg-blue-400' },
  ar: { label: 'Arabic', dot: 'bg-indigo-400' },
  th: { label: 'Thai', dot: 'bg-lime-400' },
  vi: { label: 'Vietnamese', dot: 'bg-green-300' },
  id: { label: 'Indonesian', dot: 'bg-red-300' },
}

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
      [result.title, ...result.alternativeTitles]
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
        .flatMap((item) => item.alternativeTitles)
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
  const [selectedManga, setSelectedManga] = useState<{
    sourceId: MangaSourceId
    mangaId: string
    title: string
    coverUrl?: string | null
    language?: string | null
  } | null>(null)

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
      return SOURCE_META[left.sourceId].label.localeCompare(
        SOURCE_META[right.sourceId].label,
      )
    })
  }, [enabledSources, filteredSources])

  const directoryEntries = useMemo(
    () => buildDirectoryEntries(mergedResults),
    [mergedResults],
  )

  const sourceResultRows = useMemo(
    () =>
      sourceDeck
        .filter((source) => enabledSources.has(source.sourceId))
        .map((source) => ({
          source,
          count: resultCountBySource.get(source.sourceId) ?? 0,
          health: healthMap.get(source.sourceId),
        }))
        .sort((left, right) => right.count - left.count),
    [enabledSources, healthMap, resultCountBySource, sourceDeck],
  )

  const isSearching = searchTerm.length >= 2
  const anyLoading = loadingCount > 0
  const activeLanguageLabel = langFilter
    ? (LANG_META[langFilter]?.label ?? langFilter.toUpperCase())
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
        onBack={() => setSelectedManga(null)}
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
    <div className="animate-page-in font-jpSans space-y-6 pb-10">
      <div aria-live="polite" className="sr-only">
        {isSearching
          ? `${totalDirectoryMatches} grouped matches across ${activeSourceIds.length} active sources`
          : `${filteredSources.length} sources ready to search`}
      </div>

      <section className="relative overflow-hidden rounded-[30px] border border-ink-800/50 bg-ink-900/70 px-5 py-6 shadow-card sm:px-6">
        <div className="pointer-events-none absolute inset-0 opacity-100">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.10),transparent_34%),radial-gradient(circle_at_80%_16%,rgba(125,211,252,0.10),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_38%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>

        <div className="relative grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-end">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-800/60 bg-ink-950/70 px-3 py-1 font-opsMono text-[11px] uppercase tracking-[0.24em] text-ink-400">
                Browse Sources
              </span>
              <StatusBadge label={`${filteredSources.length} visible`} tone="neutral" />
              <StatusBadge
                label={healthSummary.red > 0 ? `${healthSummary.red} down` : 'health mostly clear'}
                tone={healthSummary.red > 0 ? 'danger' : 'success'}
              />
              <StatusBadge label={activeLanguageLabel} tone="neutral" />
            </div>

            <div className="max-w-3xl space-y-3">
              <h1 className="font-jpSerif text-3xl font-semibold tracking-[-0.04em] text-ink-50 sm:text-4xl xl:text-[3.35rem] xl:leading-[1.04]">
                Find a series, compare mirrors, then open the source that actually has the chapters.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-ink-300 sm:text-base">
                Search first, filter with intent, and see the same title grouped across sources instead
                of buried in duplicate result cards.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <OverviewTile
                label="Active sources"
                value={`${activeSourceIds.length}/${filteredSources.length}`}
                note={hasActiveSources ? 'Ready for parallel lookup' : 'Choose at least one source'}
              />
              <OverviewTile
                label="Raw hits"
                value={isSearching ? `${totalCount}` : '--'}
                note={isSearching ? 'Total entries returned by the search' : 'Waiting for a query'}
              />
              <OverviewTile
                label="Grouped titles"
                value={isSearching ? `${totalDirectoryMatches}` : '--'}
                note={isSearching ? 'Merged by title across mirrors' : 'Compare-ready once you search'}
              />
            </div>
          </div>
          <form
            onSubmit={handleSearch}
            className="relative overflow-hidden rounded-[28px] border border-ink-800/60 bg-ink-950/80 p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.48)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%)]" />
            <div className="relative space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-opsMono text-[11px] uppercase tracking-[0.22em] text-ink-500">
                    Search
                  </p>
                  <h2 className="mt-1 font-jpSerif text-2xl font-semibold text-ink-50">
                    Start from the title, not from the source list.
                  </h2>
                </div>
                <span className="rounded-full border border-ink-800/60 bg-ink-950/80 px-2.5 py-1 font-opsMono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  Ctrl K
                </span>
              </div>

              <div className="rounded-[22px] border border-ink-800/60 bg-ink-900/65 p-3">
                <div className="flex items-center gap-3 rounded-[18px] border border-ink-800/70 bg-ink-950/90 px-3 py-3">
                  <Search className="h-4 w-4 shrink-0 text-ink-300" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Try a manga title, alt title, or series name..."
                    className="min-w-0 flex-1 bg-transparent text-sm text-ink-100 placeholder:text-ink-600 focus:outline-none"
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
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={query.trim().length < 2 || !hasActiveSources}
                    className="min-w-[108px] justify-center rounded-full !px-4"
                  >
                    {anyLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching
                      </>
                    ) : (
                      <>
                        Search titles
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-full"
                    onClick={handleClearSearch}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() => inputRef.current?.focus()}
                  >
                    Focus search
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SearchReadout
                  label="Scope"
                  value={String(activeSourceIds.length)}
                  note={hasActiveSources ? 'Sources active for the next lookup' : 'No source currently active'}
                />
                <SearchReadout
                  label="Language"
                  value={activeLanguageLabel}
                  note={langFilter ? 'Results filtered before search fan-out' : 'All languages currently in play'}
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-ink-500">Suggested starts</div>
                <div className="flex flex-wrap gap-2">
                  {SEARCH_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSuggestedQuery(suggestion)}
                      className="cursor-pointer rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-ink-300 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.08] hover:text-ink-100"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </form>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card className="rounded-[26px] border-ink-800/50 bg-ink-900/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-opsMono text-[11px] uppercase tracking-[0.22em] text-ink-500">
                  Search scope
                </p>
                <h2 className="mt-1 font-jpSerif text-2xl font-semibold text-ink-50">
                  Filters
                </h2>
              </div>
              <Languages className="h-5 w-5 text-ink-500" />
            </div>

            <div className="mt-4 grid gap-3">
              <ScopeRow label="Sources active" value={`${activeSourceIds.length}/${filteredSources.length}`} />
              <ScopeRow label="Language" value={activeLanguageLabel} />
              <ScopeRow label="Healthy" value={`${healthSummary.green} stable`} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <HealthMiniPill label="Stable" count={healthSummary.green} tone="success" />
              <HealthMiniPill label="Watch" count={healthSummary.yellow} tone="warn" />
              <HealthMiniPill label="Down" count={healthSummary.red} tone="danger" />
            </div>
          </Card>

          <Card className="rounded-[26px] border-ink-800/50 bg-ink-900/60 p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-opsMono text-[11px] uppercase tracking-[0.22em] text-ink-500">
                  Language lane
                </p>
                <h2 className="mt-1 font-jpSerif text-xl font-semibold text-ink-50">
                  Narrow the catalog
                </h2>
              </div>
              <span className="text-xs text-ink-500">{availableLanguages.length}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <DirectoryFilterChip
                label="All languages"
                active={!langFilter}
                onClick={() => setLangFilter(null)}
              />
              {availableLanguages.map((language) => {
                const meta = LANG_META[language]
                return (
                  <DirectoryFilterChip
                    key={language}
                    label={meta?.label ?? language.toUpperCase()}
                    dotClass={meta?.dot}
                    active={langFilter === language}
                    onClick={() =>
                      setLangFilter((current) => (current === language ? null : language))
                    }
                  />
                )
              })}
            </div>
          </Card>

          <Card className="rounded-[26px] border-ink-800/50 bg-ink-900/60 p-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="font-opsMono text-[11px] uppercase tracking-[0.22em] text-ink-500">
                    Sources
                  </p>
                  <h2 className="mt-1 font-jpSerif text-xl font-semibold text-ink-50">
                    Choose mirrors
                  </h2>
                </div>
                <span className="text-xs text-ink-500">{sourceDeck.length} shown</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  onClick={enableAllSources}
                >
                  Enable all
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  onClick={enableHealthySources}
                >
                  Healthy only
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => refreshHealthMutation.mutate()}
                  loading={refreshHealthMutation.isPending}
                >
                  {!refreshHealthMutation.isPending && <RefreshCcw className="h-4 w-4" />}
                  Refresh
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {sourceDeck.map((source) => (
                <SourceToggleRow
                  key={source.sourceId}
                  source={source}
                  active={enabledSources.has(source.sourceId)}
                  health={healthMap.get(source.sourceId)}
                  resultCount={resultCountBySource.get(source.sourceId) ?? 0}
                  onToggle={() => toggleSource(source.sourceId)}
                />
              ))}
            </div>

            <Link
              to="/settings/sources"
              className="mt-4 inline-flex items-center gap-2 text-sm text-ink-400 transition-colors hover:text-ink-100"
            >
              <Activity className="h-4 w-4" />
              Open full source settings
            </Link>
          </Card>
        </aside>

        <section className="space-y-4">
          {!isSearching && (
            <DirectoryLanding
              sourceCount={filteredSources.length}
              sourceDeck={sourceDeck}
              healthMap={healthMap}
              onSuggestionClick={handleSuggestedQuery}
            />
          )}

          {isSearching && !hasActiveSources && (
            <div role="alert">
              <ErrorState
                message="No source selected"
                hint="Enable at least one source in the left rail before launching a search."
              />
            </div>
          )}

          {isSearching && anyLoading && totalCount === 0 && hasActiveSources && (
            <DirectoryLoadingState />
          )}

          {isSearching && !anyLoading && errorCount > 0 && totalCount === 0 && hasActiveSources && (
            <div role="alert">
              <ErrorState
                message={`Search failed on ${errorCount} source${errorCount !== 1 ? 's' : ''}`}
                hint="The query returned no usable entries. Refresh health, widen the language lane, or reduce the active source set."
                onRetry={() => {
                  queryClient.invalidateQueries({ queryKey: ['manga-search'] })
                }}
              />
            </div>
          )}

          {isSearching && !anyLoading && totalCount === 0 && errorCount === 0 && hasActiveSources && (
            <DirectoryNoResults
              searchTerm={searchTerm}
              onSuggestionClick={handleSuggestedQuery}
            />
          )}

          {isSearching && totalCount > 0 && (
            <div className="space-y-4">
              <Card className="rounded-[26px] border-ink-800/50 bg-ink-900/60 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="font-opsMono text-[11px] uppercase tracking-[0.22em] text-ink-500">
                      Search results
                    </p>
                    <h2 className="mt-1 font-jpSerif text-3xl font-semibold text-ink-50">
                      {totalDirectoryMatches} grouped match{totalDirectoryMatches !== 1 ? 'es' : ''} for "{searchTerm}"
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-400">
                      Results are grouped by title so you can compare availability across mirrors before opening a detail page.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <SummaryBadge label="Raw hits" value={String(totalCount)} />
                    <SummaryBadge label="Sources" value={String(activeSourceIds.length)} />
                    <SummaryBadge label="Language" value={activeLanguageLabel} />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <OverviewTile
                      label="Compared titles"
                      value={String(totalDirectoryMatches)}
                      note="Distinct grouped works"
                    />
                    <OverviewTile
                      label="Raw source hits"
                      value={String(totalCount)}
                      note="All entries before grouping"
                    />
                    <OverviewTile
                      label="Still loading"
                      value={String(loadingCount)}
                      note={anyLoading ? 'Some sources are still responding' : 'All active searches have answered'}
                    />
                  </div>

                  <div className="rounded-[22px] border border-ink-800/60 bg-ink-950/60 px-4 py-4">
                    <p className="font-opsMono text-[11px] uppercase tracking-[0.22em] text-ink-500">
                      Source contribution
                    </p>
                    <div className="mt-3 space-y-2">
                      {sourceResultRows.map(({ source, count, health }) => (
                        <ContributionRow
                          key={source.sourceId}
                          sourceId={source.sourceId}
                          count={count}
                          latency={health?.latencyMs}
                          error={health?.error}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              <div className="grid gap-4 2xl:grid-cols-2">
                {directoryEntries.map((entry) => (
                  <DirectoryResultCard
                    key={entry.key}
                    entry={entry}
                    onOpenLead={() => handleMangaClick(entry.lead)}
                    onOpenVariant={handleMangaClick}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function OverviewTile({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <div className="rounded-[22px] border border-ink-800/60 bg-ink-950/65 px-4 py-4">
      <p className="font-opsMono text-[11px] uppercase tracking-[0.2em] text-ink-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink-50">{value}</p>
      <p className="mt-1 text-xs leading-6 text-ink-500">{note}</p>
    </div>
  )
}

function SearchReadout({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <div className="rounded-[20px] border border-ink-800/60 bg-ink-900/55 px-4 py-3">
      <p className="font-opsMono text-[11px] uppercase tracking-[0.18em] text-ink-600">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold text-ink-50">{value}</p>
      <p className="mt-1 text-xs text-ink-500">{note}</p>
    </div>
  )
}

function StatusBadge({
  label,
  tone,
}: {
  label: string
  tone: 'neutral' | 'success' | 'danger'
}) {
  return (
    <span
      className={clsx(
        'rounded-full px-3 py-1 text-xs',
        tone === 'neutral' && 'border border-ink-800/60 bg-ink-950/70 text-ink-400',
        tone === 'success' && 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20',
        tone === 'danger' && 'bg-red-500/10 text-red-300 ring-1 ring-red-500/20',
      )}
    >
      {label}
    </span>
  )
}

function ScopeRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-ink-800/60 bg-ink-950/55 px-4 py-3">
      <span className="text-sm text-ink-400">{label}</span>
      <span className="font-opsMono text-sm text-ink-100">{value}</span>
    </div>
  )
}

function HealthMiniPill({
  label,
  count,
  tone,
}: {
  label: string
  count: number
  tone: 'success' | 'warn' | 'danger'
}) {
  return (
    <div
      className={clsx(
        'rounded-2xl px-3 py-3 text-center',
        tone === 'success' && 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20',
        tone === 'warn' && 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20',
        tone === 'danger' && 'bg-red-500/10 text-red-300 ring-1 ring-red-500/20',
      )}
    >
      <p className="font-opsMono text-[10px] uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{count}</p>
    </div>
  )
}

function DirectoryFilterChip({
  label,
  active,
  onClick,
  dotClass,
}: {
  label: string
  active: boolean
  onClick: () => void
  dotClass?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'cursor-pointer rounded-full px-3 py-2 text-xs font-medium transition-all duration-200',
        active
          ? 'bg-accent-600/15 text-accent-300 ring-1 ring-accent-500/25'
          : 'bg-ink-950/55 text-ink-400 ring-1 ring-ink-800/60 hover:bg-ink-950/80 hover:text-ink-200',
      )}
    >
      <span className="flex items-center gap-2">
        {dotClass && <span className={clsx('h-2 w-2 rounded-full', dotClass)} />}
        {label}
      </span>
    </button>
  )
}

function HealthDot({ status }: { status?: HealthStatus }) {
  if (!status) return <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
  return <span className={clsx('h-2.5 w-2.5 rounded-full', HEALTH_META[status].dot)} />
}

function SourceToggleRow({
  source,
  active,
  health,
  resultCount,
  onToggle,
}: {
  source: { sourceId: MangaSourceId; languages: string[] }
  active: boolean
  health?: { status: HealthStatus; latencyMs: number | null; error: string | null }
  resultCount: number
  onToggle: () => void
}) {
  const meta = SOURCE_META[source.sourceId]
  const healthMeta = health ? HEALTH_META[health.status] : null

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={clsx(
        'w-full rounded-[22px] border px-4 py-3 text-left transition-all duration-200',
        active
          ? 'border-accent-700/30 bg-accent-950/10'
          : 'border-ink-800/60 bg-ink-950/55 hover:bg-ink-950/75',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={clsx('h-2.5 w-2.5 rounded-full', meta.accentDot)} />
            <span className="font-medium text-ink-100">{meta.label}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-500">{meta.blurb}</p>
        </div>
        <span
          className={clsx(
            'rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]',
            active ? meta.accentSoft : 'bg-ink-800/90 text-ink-400',
          )}
        >
          {active ? 'On' : 'Off'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <ScopeRow label="Lang" value={String(source.languages.length)} />
        <ScopeRow label="Hits" value={resultCount > 0 ? String(resultCount) : '--'} />
        <ScopeRow label="Latency" value={formatLatency(health?.latencyMs)} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink-800/50 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <HealthDot status={health?.status} />
          <span className="truncate text-xs text-ink-500">
            {healthMeta?.note ?? 'Waiting for health probe'}
          </span>
        </div>
        <ChevronRight className="h-4 w-4 text-ink-600" />
      </div>
    </button>
  )
}

function SummaryBadge({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <span className="rounded-full border border-ink-800/60 bg-ink-950/70 px-3 py-1.5 text-xs text-ink-300">
      <span className="text-ink-500">{label}:</span> {value}
    </span>
  )
}

function ContributionRow({
  sourceId,
  count,
  latency,
  error,
}: {
  sourceId: MangaSourceId
  count: number
  latency: number | null | undefined
  error: string | null | undefined
}) {
  const meta = SOURCE_META[sourceId]
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink-800/50 bg-ink-900/50 px-4 py-3">
      <span className={clsx('h-2.5 w-2.5 rounded-full', meta.accentDot)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink-100">{meta.label}</span>
          <span className="text-xs text-ink-500">{formatLatency(latency)}</span>
        </div>
        <p className="truncate text-xs text-ink-500">{error || 'Healthy response cycle'}</p>
      </div>
      <span className="rounded-full bg-ink-950/70 px-2.5 py-1 font-opsMono text-xs text-ink-200">
        {count}
      </span>
    </div>
  )
}

function DirectoryLanding({
  sourceCount,
  sourceDeck,
  healthMap,
  onSuggestionClick,
}: {
  sourceCount: number
  sourceDeck: Array<{ sourceId: MangaSourceId; languages: string[] }>
  healthMap: Map<MangaSourceId, { status: HealthStatus; latencyMs: number | null; error: string | null }>
  onSuggestionClick: (value: string) => void
}) {
  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] border-ink-800/50 bg-ink-900/60 p-6">
        <div className="max-w-3xl space-y-4">
          <p className="font-opsMono text-[11px] uppercase tracking-[0.22em] text-ink-500">
            Directory mode
          </p>
          <h3 className="font-jpSerif text-3xl font-semibold tracking-[-0.03em] text-ink-50">
            Search across {sourceCount} visible sources from one place.
          </h3>
          <p className="max-w-2xl text-sm leading-7 text-ink-400">
            Pick a title, let KometaManga compare the mirrors, then open the one that looks healthiest and most complete.
          </p>

          <div className="flex flex-wrap gap-2">
            {SEARCH_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionClick(suggestion)}
                className="cursor-pointer rounded-full border border-ink-800/60 bg-ink-950/60 px-3 py-2 text-sm text-ink-300 transition-all duration-200 hover:bg-ink-950/80 hover:text-ink-100"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="rounded-[28px] border-ink-800/50 bg-ink-900/60 p-6">
          <p className="font-opsMono text-[11px] uppercase tracking-[0.22em] text-ink-500">
            How to use it
          </p>
          <div className="mt-4 space-y-3">
            <LandingNote
              title="Search by series"
              description="Start from the work you want, not the provider you guess might have it."
            />
            <LandingNote
              title="Filter with purpose"
              description="Use the left rail only when you need to constrain language or exclude weak mirrors."
            />
            <LandingNote
              title="Compare before opening"
              description="Grouped results let you see how many sources carry the same title at a glance."
            />
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sourceDeck.map((source) => (
            <SourceShelfCard
              key={source.sourceId}
              source={source}
              health={healthMap.get(source.sourceId)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function LandingNote({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-ink-800/60 bg-ink-950/55 px-4 py-3">
      <p className="text-base font-semibold text-ink-100">{title}</p>
      <p className="mt-1 text-sm leading-6 text-ink-400">{description}</p>
    </div>
  )
}

function SourceShelfCard({
  source,
  health,
}: {
  source: { sourceId: MangaSourceId; languages: string[] }
  health?: { status: HealthStatus; latencyMs: number | null; error: string | null }
}) {
  const meta = SOURCE_META[source.sourceId]
  return (
    <Card className="rounded-[24px] border-ink-800/50 bg-ink-900/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={clsx('h-2.5 w-2.5 rounded-full', meta.accentDot)} />
            <span className="font-opsMono text-[11px] uppercase tracking-[0.18em] text-ink-500">
              {source.sourceId}
            </span>
          </div>
          <h4 className="mt-2 text-lg font-semibold text-ink-100">{meta.label}</h4>
        </div>
        <HealthDot status={health?.status} />
      </div>

      <p className="mt-3 text-sm leading-6 text-ink-400">{meta.blurb}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ScopeRow label="Languages" value={String(source.languages.length)} />
        <ScopeRow label="Latency" value={formatLatency(health?.latencyMs)} />
      </div>
    </Card>
  )
}

function DirectoryLoadingState() {
  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-ink-800/40 bg-ink-900/40 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-[22px]" />
          <Skeleton className="h-24 rounded-[22px]" />
          <Skeleton className="h-24 rounded-[22px]" />
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-[24px] border border-ink-800/40 bg-ink-900/40 p-5">
            <div className="grid gap-4 md:grid-cols-[108px_1fr]">
              <Skeleton className="h-40 rounded-[18px]" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-4/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-32 rounded-full" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-9 w-24 rounded-full" />
                  <Skeleton className="h-9 w-24 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DirectoryNoResults({
  searchTerm,
  onSuggestionClick,
}: {
  searchTerm: string
  onSuggestionClick: (value: string) => void
}) {
  return (
    <Card className="rounded-[28px] border-ink-800/50 bg-ink-900/60 p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <p className="font-opsMono text-[11px] uppercase tracking-[0.22em] text-ink-500">
            No matches
          </p>
          <h3 className="font-jpSerif text-2xl font-semibold text-ink-50">
            Nothing surfaced for "{searchTerm}".
          </h3>
          <p className="max-w-2xl text-sm leading-7 text-ink-400">
            Try a broader title, remove the language filter, or enable more sources in the left rail.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {SEARCH_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestionClick(suggestion)}
              className="cursor-pointer rounded-full border border-ink-800/60 bg-ink-950/60 px-3 py-2 text-sm text-ink-300 transition-all duration-200 hover:bg-ink-950/80 hover:text-ink-100"
            >
              Try {suggestion}
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}

function DirectoryResultCard({
  entry,
  onOpenLead,
  onOpenVariant,
}: {
  entry: DirectoryEntry
  onOpenLead: () => void
  onOpenVariant: (result: MangaSearchResultDto) => void
}) {
  const { lead } = entry
  const meta = SOURCE_META[lead.sourceId]

  return (
    <Card className="rounded-[26px] border-ink-800/50 bg-ink-900/60 p-5">
      <button
        type="button"
        onClick={onOpenLead}
        className="group w-full text-left"
      >
        <div className="grid gap-4 md:grid-cols-[108px_1fr]">
          <div className="overflow-hidden rounded-[18px] bg-ink-950/80">
            {lead.coverUrl ? (
              <img
                src={imageProxyUrl(lead.coverUrl) ?? lead.coverUrl}
                alt={`${lead.title} cover`}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full min-h-[10rem] items-center justify-center text-ink-700">
                <BookOpen className="h-6 w-6" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={clsx('rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]', meta.accentSoft)}>
                Lead: {meta.label}
              </span>
              <span className="rounded-full border border-ink-800/60 bg-ink-950/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-ink-400">
                {entry.sourceCount} source{entry.sourceCount !== 1 ? 's' : ''}
              </span>
              {lead.status && (
                <span className={clsx('rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]', STATUS_META[lead.status])}>
                  {lead.status}
                </span>
              )}
            </div>

            <h3 className="mt-3 line-clamp-2 font-jpSerif text-2xl font-semibold leading-tight text-ink-50">
              {lead.title}
            </h3>
            {entry.primaryAltTitle && (
              <p className="mt-1 line-clamp-1 text-sm text-ink-500">{entry.primaryAltTitle}</p>
            )}

            <p className="mt-3 text-sm leading-7 text-ink-400">
              Best match chosen from the grouped results. Open this to inspect chapters fast, or pick a specific mirror below.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-500">
              <span>{lead.year ? `Year ${lead.year}` : 'Year unknown'}</span>
              <span>{entry.variants.length} available entries</span>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ink-100">
              Open lead result
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </button>

      <div className="mt-5 border-t border-ink-800/50 pt-4">
        <p className="font-opsMono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          Available mirrors
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.variants.map((variant) => {
            const variantMeta = SOURCE_META[variant.sourceId]
            return (
              <button
                key={`${variant.sourceId}-${variant.id}`}
                type="button"
                onClick={() => onOpenVariant(variant)}
                className="inline-flex items-center gap-2 rounded-full border border-ink-800/60 bg-ink-950/60 px-3 py-2 text-sm text-ink-300 transition-all duration-200 hover:bg-ink-950/85 hover:text-ink-100"
              >
                <span className={clsx('h-2 w-2 rounded-full', variantMeta.accentDot)} />
                {variantMeta.label}
                {variant.status && (
                  <span className={clsx('rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]', STATUS_META[variant.status])}>
                    {variant.status}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function SourcesPageSkeleton() {
  return (
    <div className="animate-page-in space-y-6 pb-10">
      <div className="rounded-[30px] border border-ink-800/50 bg-ink-900/50 p-6">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-14 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-24 rounded-[22px]" />
              <Skeleton className="h-24 rounded-[22px]" />
              <Skeleton className="h-24 rounded-[22px]" />
            </div>
          </div>
          <Skeleton className="h-[24rem] rounded-[28px]" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-[26px]" />
          <Skeleton className="h-44 rounded-[26px]" />
          <Skeleton className="h-[32rem] rounded-[26px]" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-[28px]" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-56 rounded-[24px]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
