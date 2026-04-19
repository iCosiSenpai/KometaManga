import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  BookOpen,
  Command,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { api, imageProxyUrl } from '@/api/client'
import type {
  HealthStatus,
  MangaSearchResultDto,
  MangaSourceId,
  MangaStatus,
} from '@/api/sources'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'
import { MangaDetailPanel } from '@/components/MangaDetailPanel'
import { Flag } from '@/components/Flag'
import { SourceIcon } from '@/components/SourceIcon'
import { SOURCE_BRAND, langLabel } from '@/lib/brand'
import { ActiveFilterChips, type FilterChip } from '@/components/filters/ActiveFilterChips'
import { Eyebrow, HeroTitle, SectionTitle } from '@/components/atelier'

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

const HEALTH_DOT: Record<HealthStatus, string> = {
  GREEN: 'ma-bg-ok',
  YELLOW: 'ma-bg-warn',
  RED: 'ma-bg-accent',
}

const HEALTH_NOTE: Record<HealthStatus, string> = {
  GREEN: 'Stabile',
  YELLOW: 'Lenta o degradata',
  RED: 'Non disponibile',
}

const STATUS_LABEL: Record<MangaStatus, string> = {
  ONGOING: 'In corso',
  COMPLETED: 'Completato',
  HIATUS: 'In pausa',
  CANCELLED: 'Cancellato',
  UNKNOWN: 'Ignoto',
}

const EMPTY_SOURCE_LIST: Array<{ sourceId: MangaSourceId; languages: string[] }> = []

function formatLatency(latencyMs: number | null | undefined) {
  if (latencyMs == null) return '—'
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
  const [hideNsfw, setHideNsfw] = useState<boolean>(() => {
    try { return localStorage.getItem('kometa.hideNsfw') !== 'false' } catch { return true }
  })
  const [statusFilter, setStatusFilter] = useState<MangaStatus | null>(null)
  useEffect(() => {
    try { localStorage.setItem('kometa.hideNsfw', String(hideNsfw)) } catch { /* ignore */ }
  }, [hideNsfw])
  const [trendingPicks, setTrendingPicks] = useState<string[]>(() => pickTrending(5))

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
      toast('Stato delle sorgenti aggiornato', 'success')
    },
    onError: (error: Error) => {
      toast(error.message || 'Impossibile aggiornare lo stato delle sorgenti', 'error')
    },
  })

  const downloadMutation = useMutation({
    mutationFn: api.downloadChapters,
    onSuccess: (items) => {
      toast(
        `${items.length} capitol${items.length !== 1 ? 'i' : 'o'} in coda per il download`,
        'success',
      )
      queryClient.invalidateQueries({ queryKey: ['download-queue'] })
      queryClient.invalidateQueries({ queryKey: ['download-status'] })
    },
    onError: (error: Error) => {
      toast(error.message || 'Impossibile accodare i download', 'error')
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

  const filteredDirectoryEntries = useMemo(() => {
    return directoryEntries.filter((entry) => {
      if (hideNsfw) {
        const anyNsfw = entry.variants.some(
          (v) => v.contentRating === 'erotica' || v.contentRating === 'pornographic',
        )
        if (anyNsfw) return false
      }
      if (statusFilter && entry.lead.status !== statusFilter) return false
      return true
    })
  }, [directoryEntries, hideNsfw, statusFilter])

  const isSearching = searchTerm.length >= 2
  const anyLoading = loadingCount > 0
  const hasActiveSources = activeSourceIds.length > 0
  const totalDirectoryMatches = filteredDirectoryEntries.length
  const healthyCount = useMemo(
    () => sources.filter((s) => (healthMap.get(s.sourceId)?.status ?? 'GREEN') !== 'RED').length,
    [sources, healthMap],
  )

  const activeFilterChips: FilterChip[] = useMemo(() => {
    const chips: FilterChip[] = []
    if (statusFilter) {
      chips.push({
        key: 'status',
        label: `stato · ${STATUS_LABEL[statusFilter].toLowerCase()}`,
        onRemove: () => setStatusFilter(null),
      })
    }
    if (!hideNsfw) {
      chips.push({
        key: 'nsfw',
        label: 'NSFW visibile',
        tone: 'warn',
        onRemove: () => setHideNsfw(true),
      })
    }
    if (langFilter) {
      chips.push({
        key: 'lang',
        label: `lingua · ${langLabel(langFilter)}`,
        onRemove: () => setLangFilter(null),
      })
    }
    return chips
  }, [statusFilter, hideNsfw, langFilter])

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
          if (window.history.state?.kometaDetail) window.history.back()
          else setSelectedManga(null)
        }}
        onDownload={(sourceId, mangaId, chapterIds, target) => {
          downloadMutation.mutate({
            sourceId,
            mangaId,
            chapterIds,
            libraryPath: target?.libraryPath ?? null,
            libraryId: target?.libraryId ?? null,
          })
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
          message="Impossibile caricare le sorgenti."
          hint="Il registro non risponde. Riprova quando il backend è online."
          onRetry={() => sourcesQuery.refetch()}
        />
      </div>
    )
  }

  return (
    <div className="animate-fade-in pb-16">
      <div aria-live="polite" className="sr-only">
        {isSearching
          ? `${totalDirectoryMatches} risultati aggregati su ${activeSourceIds.length} sorgenti attive`
          : `${filteredSources.length} sorgenti pronte per la ricerca`}
      </div>

      {/* ── Hero ── */}
      <section className="pt-4 pb-10">
        <Eyebrow jp="ソース" en="Sources" />
        <HeroTitle className="mt-4 max-w-3xl">Trova un titolo.</HeroTitle>
        <p className="mt-4 max-w-xl font-sans text-[15px] leading-relaxed ma-muted">
          Cerca in parallelo su {filteredSources.length} sorgent{filteredSources.length === 1 ? 'e' : 'i'}
          {' '}— rimuovo i doppioni e ti mostro un solo risultato per titolo.
        </p>

        <form onSubmit={handleSearch} className="mt-8 max-w-3xl">
          <div className="ma-input-line">
            {anyLoading ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin ma-accent" aria-hidden />
            ) : (
              <Search className="h-5 w-5 shrink-0 ma-faint" aria-hidden />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca un manga…"
              aria-label="Cerca manga"
            />
            {query && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="shrink-0 rounded-full p-1 ma-faint transition-colors hover:ma-text"
                aria-label="Pulisci ricerca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <span className="ma-kbd" aria-hidden>
              {isMac ? <><Command className="h-2.5 w-2.5" />K</> : 'Ctrl+K'}
            </span>
          </div>
        </form>

        {/* Trending strip (idle) / Live counters (searching) */}
        {!isSearching ? (
          <div className="mt-5 flex max-w-3xl flex-wrap items-center gap-2">
            <Eyebrow jp="人気" en="In tendenza" className="mr-2" />
            {trendingPicks.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSuggestedQuery(s)}
                className="ma-chip"
              >
                {s}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTrendingPicks(pickTrending(5))}
              className="ma-microlink ml-1"
              title="Altri suggerimenti"
            >
              <RefreshCw className="h-3 w-3" />
              Altri
            </button>
          </div>
        ) : (
          <div className="mt-5 flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-1 font-opsMono text-[11px] uppercase tracking-[0.18em] ma-muted">
            <span>{activeSourceIds.length} attiv{activeSourceIds.length === 1 ? 'a' : 'e'}</span>
            <span aria-hidden className="ma-faint">·</span>
            <span>{totalDirectoryMatches} risultat{totalDirectoryMatches === 1 ? 'o' : 'i'}</span>
            {errorCount > 0 && (
              <>
                <span aria-hidden className="ma-faint">·</span>
                <span className="ma-warn">{errorCount} in errore</span>
              </>
            )}
            {anyLoading && (
              <>
                <span aria-hidden className="ma-faint">·</span>
                <span className="ma-accent">{loadingCount} in corso</span>
              </>
            )}
          </div>
        )}
      </section>

      {/* ── Filter Strip (always visible) ── */}
      <section className="pb-10">
        {activeFilterChips.length > 0 && (
          <ActiveFilterChips chips={activeFilterChips} className="mb-6" />
        )}

        <SectionTitle
          title="Sorgenti"
          jp="ソース"
          size="md"
          action={{ label: 'Gestisci', to: '/settings/sources' }}
        />

        <div className="flex flex-wrap items-center gap-2">
          {sourceDeck.map((source) => {
            const meta = SOURCE_BRAND[source.sourceId]
            const active = enabledSources.has(source.sourceId)
            const health = healthMap.get(source.sourceId)
            const dotClass = health ? HEALTH_DOT[health.status] : 'ma-bg-accent-soft'
            return (
              <button
                key={source.sourceId}
                type="button"
                onClick={() => toggleSource(source.sourceId)}
                className={clsx('ma-chip', active && 'ma-chip-active', !active && 'ma-chip-disabled')}
                title={health ? HEALTH_NOTE[health.status] : undefined}
              >
                <SourceIcon sourceId={source.sourceId} size={14} />
                <span>{meta.label}</span>
                <span className={clsx('h-1.5 w-1.5 rounded-full', dotClass)} aria-hidden />
                {isSearching && active && (
                  <span className="font-opsMono text-[10px] ma-faint">
                    {resultCountBySource.get(source.sourceId) ?? 0}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <button type="button" onClick={enableAllSources} className="ma-microlink">
            Tutte
          </button>
          <button type="button" onClick={enableHealthySources} className="ma-microlink">
            Solo sane
          </button>
          <button
            type="button"
            onClick={() => refreshHealthMutation.mutate()}
            disabled={refreshHealthMutation.isPending}
            className="ma-microlink"
          >
            <RefreshCw className={clsx('h-3 w-3', refreshHealthMutation.isPending && 'animate-spin')} />
            Aggiorna stato
          </button>
        </div>

        <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Lingua */}
          <div>
            <Eyebrow jp="言語" en="Lingua" />
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setLangFilter(null)}
                className={clsx('ma-chip', !langFilter && 'ma-chip-active')}
              >
                Tutte
              </button>
              {availableLanguages.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLangFilter((current) => (current === lang ? null : lang))}
                  className={clsx('ma-chip', langFilter === lang && 'ma-chip-active')}
                >
                  <Flag code={lang} />
                  {langLabel(lang)}
                </button>
              ))}
            </div>
          </div>

          {/* Stato */}
          <div>
            <Eyebrow jp="状態" en="Stato" />
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setStatusFilter(null)}
                className={clsx('ma-chip', !statusFilter && 'ma-chip-active')}
              >
                Tutti
              </button>
              {(['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED'] as MangaStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter((current) => (current === s ? null : s))}
                  className={clsx('ma-chip', statusFilter === s && 'ma-chip-active')}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Contenuto */}
          <div>
            <Eyebrow jp="内容" en="Contenuto" />
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 font-sans text-[13px] ma-text">
              <input
                type="checkbox"
                checked={hideNsfw}
                onChange={(e) => setHideNsfw(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-[color:var(--ma-hair-strong)] bg-transparent"
                style={{ accentColor: 'var(--ma-accent)' }}
              />
              Nascondi NSFW
            </label>
            <p className="mt-1.5 font-sans text-[11px] ma-faint">
              Erotica &amp; pornografico
            </p>
          </div>
        </div>
      </section>

      {/* ── Results area ── */}
      <section>
        {!isSearching && (
          <div className="animate-fade-in">
            <SectionTitle
              title="Fonti"
              jp="情報源"
              size="lg"
              right={
                <span className="font-opsMono text-[11px] uppercase tracking-[0.2em] ma-muted">
                  {healthyCount}/{sources.length} stabili
                </span>
              }
            />
            <div className="grid gap-x-10 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
              {sourceDeck.map((source) => (
                <SourceLandingRow
                  key={source.sourceId}
                  source={source}
                  health={healthMap.get(source.sourceId)}
                />
              ))}
            </div>
          </div>
        )}

        {isSearching && !hasActiveSources && (
          <div role="alert">
            <ErrorState
              message="Nessuna sorgente selezionata."
              hint="Apri almeno una sorgente qui sopra prima di cercare."
            />
          </div>
        )}

        {isSearching && anyLoading && totalCount === 0 && hasActiveSources && (
          <DirectoryLoadingState />
        )}

        {isSearching && !anyLoading && errorCount > 0 && totalCount === 0 && hasActiveSources && (
          <div role="alert">
            <ErrorState
              message={`Ricerca fallita su ${errorCount} sorgent${errorCount === 1 ? 'e' : 'i'}.`}
              hint="Aggiorna lo stato delle sorgenti o riduci i filtri attivi."
              onRetry={() => queryClient.invalidateQueries({ queryKey: ['manga-search'] })}
            />
          </div>
        )}

        {isSearching && !anyLoading && totalCount === 0 && errorCount === 0 && hasActiveSources && (
          <DirectoryNoResults
            searchTerm={searchTerm}
            onSuggestionClick={handleSuggestedQuery}
            suggestions={trendingPicks}
          />
        )}

        {isSearching && totalCount > 0 && (
          <div className="animate-fade-in">
            <SectionTitle
              title="Risultati"
              jp="結果"
              size="lg"
              right={
                <span className="font-opsMono text-[11px] uppercase tracking-[0.2em] ma-muted">
                  &ldquo;{searchTerm}&rdquo; · {totalCount} grezzi
                </span>
              }
            />
            <div className="grid gap-x-6 gap-y-8 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredDirectoryEntries.map((entry) => (
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

function SourceLandingRow({
  source,
  health,
}: {
  source: { sourceId: MangaSourceId; languages: string[] }
  health?: { status: HealthStatus; latencyMs: number | null; error: string | null }
}) {
  const meta = SOURCE_BRAND[source.sourceId]
  const dotClass = health ? HEALTH_DOT[health.status] : 'ma-bg-accent-soft'

  return (
    <div className="flex items-start gap-4 border-b ma-hair py-4 last:border-b-0">
      <SourceIcon sourceId={source.sourceId} size={22} className="mt-1 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-serif italic text-[20px] leading-none tracking-[-0.01em] ma-text">
            {meta.label}
          </h3>
          <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)} aria-hidden />
        </div>
        {meta.blurb && (
          <p className="mt-2 font-sans text-[13px] leading-snug ma-muted line-clamp-2">
            {meta.blurb}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3 font-opsMono text-[10px] uppercase tracking-[0.18em] ma-faint">
          <span>{source.languages.length} lingu{source.languages.length === 1 ? 'a' : 'e'}</span>
          <span aria-hidden>·</span>
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

  const uniqueSources = useMemo(() => {
    const seen = new Set<MangaSourceId>()
    const out: MangaSourceId[] = []
    for (const v of entry.variants) {
      if (!seen.has(v.sourceId)) {
        seen.add(v.sourceId)
        out.push(v.sourceId)
      }
    }
    return out
  }, [entry.variants])

  const visibleSources = uniqueSources.slice(0, 3)
  const hiddenSourceCount = uniqueSources.length - visibleSources.length
  const statusLabel = lead.status && lead.status !== 'UNKNOWN' ? STATUS_LABEL[lead.status] : null

  return (
    <button
      type="button"
      onClick={onOpenLead}
      className="group animate-fade-in flex flex-col items-stretch text-left"
    >
      <div className="relative overflow-hidden rounded-sm border ma-hair bg-[var(--ma-surface)] transition-colors group-hover:border-[color:var(--ma-hair-strong)]">
        <div className="aspect-[2/3] w-full overflow-hidden">
          {lead.coverUrl ? (
            <img
              src={imageProxyUrl(lead.coverUrl) ?? lead.coverUrl}
              alt={lead.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:-translate-y-1"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center ma-faint">
              <BookOpen className="h-8 w-8" />
            </div>
          )}
        </div>
        {entry.sourceCount > 1 && (
          <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-sm border ma-hair-strong bg-[color:var(--ma-surface-2)]/90 px-1.5 py-0.5 font-opsMono text-[10px] uppercase tracking-[0.14em] ma-text backdrop-blur-sm">
            <Layers className="h-2.5 w-2.5" />
            +{entry.sourceCount - 1}
          </div>
        )}
      </div>

      <div className="mt-3 px-0.5">
        <h3 className="font-serif italic text-[15px] leading-snug ma-text line-clamp-2">
          {lead.title}
        </h3>
        {entry.primaryAltTitle && (
          <p className="mt-1 font-sans text-[11px] leading-snug ma-faint line-clamp-1">
            {entry.primaryAltTitle}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <div
            className="flex items-center gap-1"
            title={uniqueSources.map((id) => SOURCE_BRAND[id].label).join(', ')}
          >
            {visibleSources.map((sourceId) => (
              <SourceIcon key={sourceId} sourceId={sourceId} size={12} />
            ))}
            {hiddenSourceCount > 0 && (
              <span className="font-opsMono text-[10px] ma-faint">+{hiddenSourceCount}</span>
            )}
          </div>
          {statusLabel && (
            <span className="font-opsMono text-[10px] uppercase tracking-[0.16em] ma-muted">
              {statusLabel}
            </span>
          )}
          {lead.year && (
            <span className="ml-auto font-opsMono text-[11px] ma-faint">{lead.year}</span>
          )}
        </div>
      </div>
    </button>
  )
}

function DirectoryLoadingState() {
  return (
    <div className="animate-fade-in">
      <SectionTitle
        title="Risultati"
        jp="結果"
        size="lg"
        right={<span className="font-opsMono text-[11px] uppercase tracking-[0.2em] ma-faint">in corso…</span>}
      />
      <div className="grid gap-x-6 gap-y-8 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-[2/3] w-full rounded-sm" />
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
    <div className="animate-fade-in">
      <SectionTitle title="Nessun risultato" jp="該当なし" size="lg" />
      <div className="max-w-2xl">
        <p className="font-serif italic text-[28px] leading-[1.1] tracking-[-0.01em] ma-text sm:text-[34px]">
          Niente per &ldquo;{searchTerm}&rdquo;.
        </p>
        <p className="mt-4 font-sans text-[14px] leading-relaxed ma-muted">
          Proviamo con una variante del titolo — oppure apri più sorgenti qui sopra.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggestionClick(s)}
              className="ma-chip"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SourcesPageSkeleton() {
  return (
    <div className="animate-fade-in pb-16">
      <div className="pt-4 pb-10 space-y-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-10 w-full max-w-3xl" />
      </div>
      <div className="pb-10 space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-28 rounded-full" />
          ))}
        </div>
      </div>
      <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  )
}
