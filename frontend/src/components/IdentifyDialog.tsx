import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type SearchResult, type IdentifyResponse, type KomgaSeries } from '@/api/client'
import { Button } from '@/components/Button'
import {
  X,
  Search,
  ExternalLink,
  Check,
  AlertTriangle,
  BookOpen,
  ArrowRight,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IdentifyDialogProps {
  /** Pre-set library context (optional) */
  libraryId?: string
  /** Library name for display */
  libraryName?: string
  /** Pre-set series context (skip series picker) */
  seriesId?: string
  /** Pre-set series name for display */
  seriesName?: string
  /** Optional initial search term */
  initialSearch?: string
  onClose: () => void
  /** Called when identify job is started successfully */
  onJobStarted?: (jobId: string) => void
}

// ---------------------------------------------------------------------------
// Main Dialog
// ---------------------------------------------------------------------------

export function IdentifyDialog({
  libraryId,
  libraryName,
  seriesId: fixedSeriesId,
  seriesName: fixedSeriesName,
  initialSearch,
  onClose,
  onJobStarted,
}: IdentifyDialogProps) {
  const queryClient = useQueryClient()
  const backdropRef = useRef<HTMLDivElement>(null)

  // Step state: pick-series → search → confirm
  const needsSeriesPick = !fixedSeriesId && !!libraryId
  const [step, setStep] = useState<'pick-series' | 'search' | 'confirm'>(
    needsSeriesPick ? 'pick-series' : 'search',
  )

  // Selected Komga series
  const [selectedSeries, setSelectedSeries] = useState<KomgaSeries | null>(
    fixedSeriesId && fixedSeriesName
      ? { id: fixedSeriesId, libraryId: libraryId ?? '', name: fixedSeriesName, booksCount: 0 }
      : null,
  )

  // Search state
  const [searchTerm, setSearchTerm] = useState(
    initialSearch ?? fixedSeriesName ?? '',
  )
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)

  const searchMutation = useMutation({
    mutationFn: (name: string) =>
      api.searchSeries({
        name,
        libraryId: libraryId,
        seriesId: selectedSeries?.id ?? fixedSeriesId,
      }),
    onSuccess: (data) => {
      setResults(data)
      setSelectedResult(null)
    },
  })

  const identifyMutation = useMutation({
    mutationFn: () => {
      if (!selectedResult) throw new Error('No result selected')
      const sid = selectedSeries?.id ?? fixedSeriesId
      if (!sid) throw new Error('Series ID is required')
      return api.identifySeries({
        libraryId: libraryId ?? null,
        seriesId: sid,
        provider: selectedResult.provider,
        providerSeriesId: selectedResult.resultId,
      })
    },
    onSuccess: (data: IdentifyResponse) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      onJobStarted?.(data.jobId)
      onClose()
    },
  })

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose()
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Focus trap
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focusable = dialog!.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    dialog.addEventListener('keydown', onKeyDown)
    dialog.querySelector<HTMLElement>('input, button')?.focus()
    return () => dialog.removeEventListener('keydown', onKeyDown)
  }, [step])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchTerm.trim()) searchMutation.mutate(searchTerm.trim())
  }

  function handleSelectSeries(series: KomgaSeries) {
    setSelectedSeries(series)
    setSearchTerm(series.name)
    setStep('search')
  }

  function handleSelectResult(r: SearchResult) {
    setSelectedResult(r)
    setStep('confirm')
  }

  const stepTitle =
    step === 'pick-series'
      ? 'Select Series'
      : step === 'search'
        ? 'Search Providers'
        : 'Confirm Identification'

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[10vh] backdrop-blur-sm"
    >
      <div ref={dialogRef} className="w-full max-w-2xl rounded-2xl border border-ink-800/60 bg-ink-950 shadow-2xl" role="dialog" aria-modal="true" aria-label="Identify series">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-800/50 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-100">
              {stepTitle}
            </h2>
            {selectedSeries && step !== 'pick-series' && (
              <p className="mt-0.5 text-xs text-ink-500">
                Target: <span className="font-medium text-ink-300">{selectedSeries.name}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {step === 'pick-series' && libraryId && (
            <SeriesPickerStep
              libraryId={libraryId}
              libraryName={libraryName}
              onSelect={handleSelectSeries}
            />
          )}
          {step === 'search' && (
            <SearchStep
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              onSearch={handleSearch}
              results={results}
              searching={searchMutation.isPending}
              error={searchMutation.error}
              selectedResult={selectedResult}
              onSelectResult={handleSelectResult}
              onPickSeries={needsSeriesPick ? () => setStep('pick-series') : undefined}
              seriesName={selectedSeries?.name}
            />
          )}
          {step === 'confirm' && (
            <ConfirmStep
              result={selectedResult!}
              seriesName={selectedSeries?.name ?? fixedSeriesName ?? selectedSeries?.id ?? ''}
              onConfirm={() => identifyMutation.mutate()}
              onBack={() => setStep('search')}
              isPending={identifyMutation.isPending}
              error={identifyMutation.error}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Series Picker Step — search Komga library by name
// ---------------------------------------------------------------------------

function SeriesPickerStep({
  libraryId,
  libraryName,
  onSelect,
}: {
  libraryId: string
  libraryName?: string
  onSelect: (series: KomgaSeries) => void
}) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const seriesQuery = useQuery({
    queryKey: ['library-series', libraryId, debouncedQuery],
    queryFn: () => api.getLibrarySeries(libraryId, debouncedQuery || undefined),
    enabled: debouncedQuery.length >= 1,
  })

  const series = seriesQuery.data ?? []

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-400">
        Search for a manga in{' '}
        <span className="font-medium text-ink-200">{libraryName ?? 'your library'}</span>:
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type manga name…"
          className="w-full rounded-lg border border-ink-700 bg-ink-900 pl-9 pr-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
          autoFocus
        />
      </div>

      {seriesQuery.isLoading && debouncedQuery && (
        <p className="text-center text-xs text-ink-500">Searching…</p>
      )}

      {seriesQuery.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900/30 bg-red-950/20 p-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {(seriesQuery.error as Error).message}
        </div>
      )}

      {series.length > 0 && (
        <div className="max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
          {series.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              className="flex w-full items-center gap-3 rounded-xl border border-ink-800/50 bg-ink-900/50 px-4 py-3 text-left transition-colors hover:border-accent-600/30 hover:bg-ink-800/50"
            >
              <BookOpen className="h-4 w-4 shrink-0 text-ink-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-200">{s.name}</p>
                <p className="text-xs text-ink-500">{s.booksCount} book{s.booksCount !== 1 ? 's' : ''}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-600" />
            </button>
          ))}
        </div>
      )}

      {!seriesQuery.isLoading && series.length === 0 && debouncedQuery.length >= 1 && !seriesQuery.isError && (
        <p className="py-6 text-center text-sm text-ink-500">
          No series found. Try a different name.
        </p>
      )}

      {!debouncedQuery && (
        <p className="py-6 text-center text-sm text-ink-500">
          Start typing to search your Komga library.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search Step — search metadata providers
// ---------------------------------------------------------------------------

function SearchStep({
  searchTerm,
  onSearchTermChange,
  onSearch,
  results,
  searching,
  error,
  onSelectResult,
  onPickSeries,
  seriesName,
}: {
  searchTerm: string
  onSearchTermChange: (v: string) => void
  onSearch: (e: React.FormEvent) => void
  results: SearchResult[]
  searching: boolean
  error: Error | null
  selectedResult: SearchResult | null
  onSelectResult: (r: SearchResult) => void
  onPickSeries?: () => void
  seriesName?: string
}) {
  return (
    <div className="space-y-4">
      {/* Back to series picker */}
      {onPickSeries && (
        <button
          onClick={onPickSeries}
          className="text-xs text-accent-400 hover:text-accent-300"
        >
          ← Change series
        </button>
      )}

      {/* Search form */}
      <form onSubmit={onSearch} className="flex gap-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          placeholder={seriesName ? `Search providers for "${seriesName}"…` : 'Enter manga/series name…'}
          className="flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
          autoFocus
        />
        <Button type="submit" variant="primary" size="sm" loading={searching}>
          <Search className="h-3.5 w-3.5" />
          Search
        </Button>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900/30 bg-red-950/20 p-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {(error as Error).message}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-ink-400">
            {results.length} result{results.length !== 1 && 's'} found
          </p>
          <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
            {results.map((r, i) => (
              <SearchResultCard key={`${r.provider}-${r.resultId}-${i}`} result={r} onSelect={onSelectResult} />
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {!searching && results.length === 0 && searchTerm && !error && (
        <p className="py-6 text-center text-sm text-ink-500">
          No results. Try a different search term.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search Result Card
// ---------------------------------------------------------------------------

function SearchResultCard({
  result,
  onSelect,
}: {
  result: SearchResult
  onSelect: (r: SearchResult) => void
}) {
  const [imgError, setImgError] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  return (
    <>
      {lightbox && result.imageUrl && (
        <CoverLightbox src={result.imageUrl} onClose={() => setLightbox(false)} />
      )}
      <div
        onClick={() => onSelect(result)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(result) } }}
        className="group flex w-full items-start gap-3 rounded-xl border border-ink-800/50 bg-ink-900/50 p-3 text-left transition-colors hover:border-accent-600/30 hover:bg-ink-800/50 cursor-pointer"
      >
        {/* Thumbnail */}
        <div
          className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-ink-800 cursor-zoom-in"
          onClick={(e) => { e.stopPropagation(); if (result.imageUrl && !imgError) setLightbox(true) }}
        >
        {result.imageUrl && !imgError ? (
          <img
            src={result.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-600">?</div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-200 group-hover:text-ink-100">
          {result.title}
        </p>
        <p className="mt-0.5 text-xs text-ink-500">
          <span className="rounded bg-ink-800 px-1.5 py-0.5 text-ink-400">
            {result.provider}
          </span>
        </p>
        {result.url && (
          <span
            onClick={(e) => { e.stopPropagation(); window.open(result.url!, '_blank', 'noopener,noreferrer') }}
            className="mt-1 inline-flex items-center gap-1 text-xs text-accent-400 hover:text-accent-300 cursor-pointer"
            role="link"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); window.open(result.url!, '_blank', 'noopener,noreferrer') } }}
          >
            <ExternalLink className="h-3 w-3" />
            View on provider
          </span>
        )}
      </div>

      {/* Select arrow */}
      <div className="flex items-center self-center text-ink-600 group-hover:text-accent-400">
        <Check className="h-4 w-4" />
      </div>
    </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Confirm Step
// ---------------------------------------------------------------------------

function ConfirmStep({
  result,
  seriesName,
  onConfirm,
  onBack,
  isPending,
  error,
}: {
  result: SearchResult
  seriesName: string
  onConfirm: () => void
  onBack: () => void
  isPending: boolean
  error: Error | null
}) {
  const [imgError, setImgError] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  return (
    <div className="space-y-5">
      {lightbox && result.imageUrl && (
        <CoverLightbox src={result.imageUrl} onClose={() => setLightbox(false)} />
      )}

      {/* Diff Preview: Komga (current) → Provider (new) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Current */}
        <div className="rounded-xl border border-ink-800/40 bg-ink-900/30 p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Current (Komga)</p>
          <p className="text-sm font-medium text-ink-200">{seriesName}</p>
          <p className="mt-1 text-xs text-ink-500">Metadata will be replaced</p>
        </div>
        {/* New */}
        <div className="rounded-xl border border-accent-800/30 bg-accent-950/10 p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-accent-400">New (Provider)</p>
          <p className="text-sm font-medium text-ink-100">{result.title}</p>
          <p className="mt-1 text-xs text-ink-500">
            <span className="rounded bg-ink-800 px-1.5 py-0.5 text-ink-400">{result.provider}</span>
          </p>
        </div>
      </div>

      {/* Selected result summary with cover */}
      <div className="flex items-start gap-4 rounded-xl border border-accent-800/30 bg-accent-950/10 p-4">
        <div
          className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-800 cursor-zoom-in"
          onClick={() => { if (result.imageUrl && !imgError) setLightbox(true) }}
        >
          {result.imageUrl && !imgError ? (
            <img
              src={result.imageUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-ink-600">?</div>
          )}
        </div>
        <div>
          <p className="font-medium text-ink-100">{result.title}</p>
          <p className="mt-1 text-xs text-ink-500">
            Provider:{' '}
            <span className="rounded bg-ink-800 px-1.5 py-0.5 text-ink-400">
              {result.provider}
            </span>
          </p>
          {result.url && (
            <span
              onClick={(e) => { e.stopPropagation(); window.open(result.url!, '_blank', 'noopener,noreferrer') }}
              className="mt-1 inline-flex items-center gap-1 text-xs text-accent-400 hover:text-accent-300 cursor-pointer"
              role="link"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') window.open(result.url!, '_blank', 'noopener,noreferrer') }}
            >
              <ExternalLink className="h-3 w-3" />
              View on provider
            </span>
          )}
        </div>
      </div>

      {/* What will happen */}
      <div className="rounded-lg border border-amber-900/30 bg-amber-950/10 px-4 py-3 text-xs text-amber-400/80">
        <p className="font-medium text-amber-400">What will happen:</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>Series metadata (title, summary, tags, genres, etc.) will be updated</li>
          <li>Cover image may be replaced if configured</li>
          <li>Book-level metadata may be updated based on provider data</li>
        </ul>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900/30 bg-red-950/20 p-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {(error as Error).message}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isPending}>
          ← Back to results
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onConfirm}
          loading={isPending}
        >
          <Check className="h-3.5 w-3.5" />
          Identify Series
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cover Lightbox — click thumbnail to see full-size
// ---------------------------------------------------------------------------

function CoverLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
      onClick={onClose}
    >
      <img
        src={src}
        alt="Cover preview"
        className="max-h-[80vh] max-w-[90vw] rounded-xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
