import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import {
  api,
  type KomfConfig,
  type KomfMediaType,
  type KomfNameMatchingMode,
  type KomfAuthorRole,
  type MangaDexLink,
  type MangaBakaMode,
  type ProvidersConfig,
  type ProviderConfig,
  type AniListConfig,
  type MangaDexConfig,
  type MangaBakaConfig,
  type SeriesMetadataConfig,
  type BookMetadataConfig,
  type ProvidersConfigUpdateRequest,
  type MetadataProvidersConfig,
} from '@/api/client'
import { useAutoSave } from '@/hooks/useAutoSave'
import { PageHeader } from '@/components/PageHeader'
import { PageSpinner } from '@/components/Spinner'
import { ErrorState } from '@/components/ErrorState'
import {
  SettingsSection,
  TextField,
  SelectField,
  MultiSelectField,
  SaveIndicator,
  NumberField,
  TagListField,
} from '@/components/settings/SettingsFields'
import { clsx } from 'clsx'
import { ChevronDown, ChevronRight, Database, Loader2, Check, Search } from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────

const PROVIDER_NAMES: Record<keyof ProvidersConfig, string> = {
  mangaUpdates: 'MangaUpdates',
  mal: 'MyAnimeList',
  nautiljon: 'Nautiljon',
  aniList: 'AniList',
  yenPress: 'Yen Press',
  kodansha: 'Kodansha',
  viz: 'VIZ Media',
  bookWalker: 'BookWalker',
  mangaDex: 'MangaDex',
  bangumi: 'Bangumi',
  comicVine: 'ComicVine',
  hentag: 'HenTag',
  mangaBaka: 'MangaBaka',
  webtoons: 'Webtoons',
}

const PROVIDER_KEYS = Object.keys(PROVIDER_NAMES) as (keyof ProvidersConfig)[]
const NO_BOOK_METADATA = new Set<string>(['aniList', 'mangaBaka'])

const MEDIA_TYPE_OPTIONS: { value: KomfMediaType; label: string }[] = [
  { value: 'MANGA', label: 'Manga' },
  { value: 'NOVEL', label: 'Novel' },
  { value: 'COMIC', label: 'Comic' },
  { value: 'WEBTOON', label: 'Webtoon' },
]

const MATCHING_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Use Global Default' },
  { value: 'CLOSEST_MATCH', label: 'Closest Match' },
  { value: 'EXACT', label: 'Exact' },
]

const GLOBAL_MATCHING_OPTIONS: { value: KomfNameMatchingMode; label: string }[] = [
  { value: 'CLOSEST_MATCH', label: 'Closest Match' },
  { value: 'EXACT', label: 'Exact' },
]

const AUTHOR_ROLE_OPTIONS: { value: KomfAuthorRole; label: string }[] = [
  { value: 'WRITER', label: 'Writer' },
  { value: 'PENCILLER', label: 'Penciller' },
  { value: 'INKER', label: 'Inker' },
  { value: 'COLORIST', label: 'Colorist' },
  { value: 'LETTERER', label: 'Letterer' },
  { value: 'COVER', label: 'Cover' },
  { value: 'EDITOR', label: 'Editor' },
  { value: 'TRANSLATOR', label: 'Translator' },
]

const MANGADEX_LINK_OPTIONS: { value: MangaDexLink; label: string }[] = [
  { value: 'MANGA_DEX', label: 'MangaDex' },
  { value: 'ANILIST', label: 'AniList' },
  { value: 'ANIME_PLANET', label: 'Anime-Planet' },
  { value: 'BOOKWALKER_JP', label: 'BookWalker JP' },
  { value: 'MANGA_UPDATES', label: 'MangaUpdates' },
  { value: 'NOVEL_UPDATES', label: 'Novel Updates' },
  { value: 'KITSU', label: 'Kitsu' },
  { value: 'AMAZON', label: 'Amazon' },
  { value: 'EBOOK_JAPAN', label: 'eBook Japan' },
  { value: 'MY_ANIME_LIST', label: 'MyAnimeList' },
  { value: 'CD_JAPAN', label: 'CD Japan' },
  { value: 'RAW', label: 'Raw' },
  { value: 'ENGLISH_TL', label: 'English TL' },
]

const MANGABAKA_MODE_OPTIONS: { value: MangaBakaMode; label: string }[] = [
  { value: 'API', label: 'API' },
  { value: 'DATABASE', label: 'Database' },
]

const SERIES_META_TOGGLES: { key: keyof SeriesMetadataConfig; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'title', label: 'Title' },
  { key: 'summary', label: 'Summary' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'readingDirection', label: 'Reading Direction' },
  { key: 'ageRating', label: 'Age Rating' },
  { key: 'language', label: 'Language' },
  { key: 'genres', label: 'Genres' },
  { key: 'tags', label: 'Tags' },
  { key: 'totalBookCount', label: 'Total Book Count' },
  { key: 'authors', label: 'Authors' },
  { key: 'releaseDate', label: 'Release Date' },
  { key: 'thumbnail', label: 'Thumbnail' },
  { key: 'links', label: 'Links' },
  { key: 'books', label: 'Books' },
  { key: 'useOriginalPublisher', label: 'Use Original Publisher' },
]

const BOOK_META_TOGGLES: { key: keyof BookMetadataConfig; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'summary', label: 'Summary' },
  { key: 'number', label: 'Number' },
  { key: 'numberSort', label: 'Number Sort' },
  { key: 'releaseDate', label: 'Release Date' },
  { key: 'authors', label: 'Authors' },
  { key: 'tags', label: 'Tags' },
  { key: 'isbn', label: 'ISBN' },
  { key: 'links', label: 'Links' },
  { key: 'thumbnail', label: 'Thumbnail' },
]

// ── Page component ───────────────────────────────────────────────

export function ProvidersSettings() {
  const configQuery = useQuery({ queryKey: ['config'], queryFn: api.getConfig })
  const librariesQuery = useQuery({ queryKey: ['libraries'], queryFn: api.getLibraries })

  if (configQuery.isLoading) return <PageSpinner />
  if (configQuery.isError)
    return <ErrorState message="Failed to load config" onRetry={() => configQuery.refetch()} />

  return (
    <ProvidersForm
      config={configQuery.data!}
      libraries={librariesQuery.data ?? []}
    />
  )
}

// ── Form ─────────────────────────────────────────────────────────

function ProvidersForm({
  config,
  libraries,
}: {
  config: KomfConfig
  libraries: { id: string; name: string }[]
}) {
  const { status, error, save, dismissError } = useAutoSave()
  const [activeTab, setActiveTab] = useState<'default' | string>('default')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [providerSearch, setProviderSearch] = useState('')

  const providersConfig = config.metadataProviders
  const currentProviders =
    activeTab === 'default'
      ? providersConfig.defaultProviders
      : providersConfig.libraryProviders[activeTab] ?? providersConfig.defaultProviders

  const libraryOverrideIds = Object.keys(providersConfig.libraryProviders)

  const sortedKeys = useMemo(() => {
    return [...PROVIDER_KEYS].sort((a, b) => {
      const pa = currentProviders[a]
      const pb = currentProviders[b]
      if (pa.enabled !== pb.enabled) return pa.enabled ? -1 : 1
      return pa.priority - pb.priority
    })
  }, [currentProviders])

  const filteredKeys = useMemo(() => {
    if (!providerSearch.trim()) return sortedKeys
    const q = providerSearch.toLowerCase()
    return sortedKeys.filter((key) =>
      PROVIDER_NAMES[key].toLowerCase().includes(q),
    )
  }, [sortedKeys, providerSearch])

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function saveProvider(
    key: string,
    patch: Record<string, unknown>,
    immediate = false,
  ) {
    if (activeTab === 'default') {
      save(
        {
          metadataProviders: {
            defaultProviders: { [key]: patch } as ProvidersConfigUpdateRequest,
          },
        },
        immediate,
      )
    } else {
      save(
        {
          metadataProviders: {
            libraryProviders: {
              [activeTab]: { [key]: patch } as ProvidersConfigUpdateRequest,
            },
          },
        },
        immediate,
      )
    }
  }

  function saveGlobal(
    patch: Partial<MetadataProvidersConfig>,
    immediate = false,
  ) {
    save({ metadataProviders: patch }, immediate)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Providers"
        description="Configure metadata providers, priorities, and granular field toggles."
      />

      <div className="space-y-6">
        <GlobalSettings
          config={providersConfig}
          onSave={saveGlobal}
          status={status}
          error={error}
          onDismissError={dismissError}
        />

        {/* Tab bar: Default + per-library overrides */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-ink-800/50 bg-ink-900/30 p-1">
          <TabButton
            active={activeTab === 'default'}
            onClick={() => setActiveTab('default')}
            label="Defaults"
          />
          {libraries.map((lib) => (
            <TabButton
              key={lib.id}
              active={activeTab === lib.id}
              onClick={() => setActiveTab(lib.id)}
              label={lib.name}
              hasOverride={libraryOverrideIds.includes(lib.id)}
            />
          ))}
        </div>

        {/* Provider search + cards */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500 pointer-events-none" />
          <input
            type="text"
            value={providerSearch}
            onChange={(e) => setProviderSearch(e.target.value)}
            placeholder="Search providers..."
            className="w-full rounded-xl border border-ink-800/50 bg-ink-900/30 py-2 pl-10 pr-3 text-sm text-ink-100 placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
            aria-label="Search providers"
          />
        </div>
        <div className="space-y-3">
          {filteredKeys.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-500">No providers match "{providerSearch}"</p>
          ) : (
            filteredKeys.map((key) => (
            <ProviderCard
              key={key}
              providerKey={key}
              provider={currentProviders[key]}
              globalConfig={providersConfig}
                envLocks={config.envLocks}
              isExpanded={expanded.has(key)}
              onToggleExpand={() => toggleExpanded(key)}
              onSave={(patch, immediate) => saveProvider(key, patch, immediate)}
              onSaveGlobal={saveGlobal}
            />
          ))
          )}
        </div>

        <SaveIndicator status={status} error={error} onDismiss={dismissError} />
      </div>
    </div>
  )
}

// ── Tab button ───────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  label,
  hasOverride,
}: {
  active: boolean
  onClick: () => void
  label: string
  hasOverride?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'relative shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-ink-800 text-ink-100'
          : 'text-ink-400 hover:bg-ink-800/50 hover:text-ink-200',
      )}
    >
      {label}
      {hasOverride && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent-500" />
      )}
    </button>
  )
}

// ── Global settings ──────────────────────────────────────────────

function GlobalSettings({
  config,
  onSave,
  status,
  error,
  onDismissError,
}: {
  config: MetadataProvidersConfig
  onSave: (patch: Partial<MetadataProvidersConfig>, immediate?: boolean) => void
  status: 'idle' | 'saving' | 'saved' | 'error'
  error: string | null
  onDismissError: () => void
}) {
  const queryClient = useQueryClient()
  const [dbProgress, setDbProgress] = useState('')
  const updateDbMutation = useMutation({
    mutationFn: () =>
      api.updateMangaBakaDb((info, completed, total) => {
        if (total > 0) {
          const pct = Math.round((completed / total) * 100)
          setDbProgress(`${pct}% — ${info}`)
        } else {
          setDbProgress(info || 'Starting…')
        }
      }),
    onSuccess: () => {
      setDbProgress('')
      queryClient.invalidateQueries({ queryKey: ['config'] })
    },
    onError: () => {
      setDbProgress('')
    },
  })

  return (
    <SettingsSection
      title="Global Provider Settings"
      description="Search matching and database management."
      action={<SaveIndicator status={status} error={error} onDismiss={onDismissError} />}
    >
      <SelectField
        label="Name Matching Mode"
        value={config.nameMatchingMode}
        options={GLOBAL_MATCHING_OPTIONS}
        description="Default method for matching series names against providers."
        onChange={(v) => onSave({ nameMatchingMode: v }, true)}
      />

      {/* MangaBaka Database */}
      <div className="flex items-center justify-between rounded-lg bg-ink-950/30 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-ink-400" />
            <span className="text-sm font-medium text-ink-200">MangaBaka Database</span>
          </div>
          {config.mangaBakaDatabase ? (
            <p className="mt-1 text-xs text-ink-500">
              Downloaded:{' '}
              {new Date(config.mangaBakaDatabase.downloadTimestamp).toLocaleDateString()}
              {' · '}
              Checksum: {config.mangaBakaDatabase.checksum.slice(0, 12)}…
            </p>
          ) : (
            <p className="mt-1 text-xs text-ink-500">No database downloaded yet.</p>
          )}
          {updateDbMutation.isPending && dbProgress && (
            <p className="mt-1 text-xs text-accent-400">{dbProgress}</p>
          )}
          {updateDbMutation.isError && (
            <p className="mt-1 text-xs text-red-400">
              {updateDbMutation.error.message}
            </p>
          )}
          {updateDbMutation.isSuccess && (
            <p className="mt-1 text-xs text-emerald-400">Database updated.</p>
          )}
        </div>
        <button
          onClick={() => updateDbMutation.mutate()}
          disabled={updateDbMutation.isPending}
          className="shrink-0 rounded-lg border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs font-medium text-ink-200 transition-colors hover:bg-ink-700 disabled:opacity-50"
        >
          {updateDbMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            'Update DB'
          )}
        </button>
      </div>
    </SettingsSection>
  )
}

// ── Provider card (accordion) ────────────────────────────────────

type AnyProviderConfig = ProviderConfig | AniListConfig | MangaDexConfig | MangaBakaConfig

function ProviderCard({
  providerKey,
  provider,
  globalConfig,
  envLocks,
  isExpanded,
  onToggleExpand,
  onSave,
  onSaveGlobal,
}: {
  providerKey: keyof ProvidersConfig
  provider: AnyProviderConfig
  globalConfig: MetadataProvidersConfig
  envLocks: KomfConfig['envLocks']
  isExpanded: boolean
  onToggleExpand: () => void
  onSave: (patch: Record<string, unknown>, immediate?: boolean) => void
  onSaveGlobal: (patch: Partial<MetadataProvidersConfig>, immediate?: boolean) => void
}) {
  const name = PROVIDER_NAMES[providerKey]
  const hasBookMeta = !NO_BOOK_METADATA.has(providerKey)

  return (
    <div
      className={clsx(
        'rounded-xl border transition-colors',
        provider.enabled
          ? 'border-ink-700/80 bg-ink-900/60'
          : 'border-ink-800/40 bg-ink-900/30 opacity-60',
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={onToggleExpand}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
        )}
        <span className="flex-1 text-sm font-medium text-ink-100">{name}</span>
        <span className="text-xs tabular-nums text-ink-500">P:{provider.priority}</span>
        {/* Enabled toggle (inline) */}
        <button
          role="switch"
          aria-checked={provider.enabled}
          aria-label={`Enable ${name}`}
          onClick={(e) => {
            e.stopPropagation()
            onSave({ enabled: !provider.enabled }, true)
          }}
          className={clsx(
            'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
            provider.enabled ? 'bg-accent-600' : 'bg-ink-700',
          )}
        >
          <span
            className={clsx(
              'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 mt-[2px]',
              provider.enabled ? 'translate-x-[18px]' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>

      {/* Body (expanded) */}
      {isExpanded && (
        <div className="space-y-5 border-t border-ink-800/50 px-4 py-4">
          {/* General */}
          <section className="space-y-3">
            <SectionLabel>General</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField
                label="Priority"
                value={provider.priority}
                min={1}
                description="Lower = higher priority."
                onChange={(v) => onSave({ priority: v ?? 10 })}
              />
              <SelectField
                label="Media Type"
                value={provider.mediaType}
                options={MEDIA_TYPE_OPTIONS}
                onChange={(v) => onSave({ mediaType: v }, true)}
              />
            </div>

            <SelectField<string>
              label="Name Matching"
              value={provider.nameMatchingMode ?? ''}
              options={MATCHING_MODE_OPTIONS}
              description="Override global name matching for this provider."
              onChange={(v) =>
                onSave(
                  { nameMatchingMode: (v as KomfNameMatchingMode) || null },
                  true,
                )
              }
            />

            <MultiSelectField
              label="Author Roles"
              values={provider.authorRoles}
              options={AUTHOR_ROLE_OPTIONS}
              onChange={(v) => onSave({ authorRoles: v }, true)}
            />

            <MultiSelectField
              label="Artist Roles"
              values={provider.artistRoles}
              options={AUTHOR_ROLE_OPTIONS}
              onChange={(v) => onSave({ artistRoles: v }, true)}
            />
          </section>

          {/* Provider-specific */}
          <ProviderSpecificFields
            providerKey={providerKey}
            provider={provider}
            globalConfig={globalConfig}
            envLocks={envLocks}
            onSave={onSave}
            onSaveGlobal={onSaveGlobal}
          />

          {/* Series Metadata */}
          <section className="space-y-3">
            <SectionLabel>Series Metadata</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {SERIES_META_TOGGLES.map(({ key, label }) => (
                <Checkbox
                  key={key}
                  label={label}
                  checked={provider.seriesMetadata[key] as boolean}
                  onChange={(v) =>
                    onSave({ seriesMetadata: { [key]: v } }, true)
                  }
                />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <TextField
                label="Original Publisher Tag"
                value={provider.seriesMetadata.originalPublisherTagName ?? ''}
                placeholder="e.g. original_publisher"
                onChange={(v) =>
                  onSave({
                    seriesMetadata: { originalPublisherTagName: v || null },
                  })
                }
              />
              <TextField
                label="English Publisher Tag"
                value={provider.seriesMetadata.englishPublisherTagName ?? ''}
                placeholder="e.g. english_publisher"
                onChange={(v) =>
                  onSave({
                    seriesMetadata: { englishPublisherTagName: v || null },
                  })
                }
              />
              <TextField
                label="French Publisher Tag"
                value={provider.seriesMetadata.frenchPublisherTagName ?? ''}
                placeholder="e.g. french_publisher"
                onChange={(v) =>
                  onSave({
                    seriesMetadata: { frenchPublisherTagName: v || null },
                  })
                }
              />
            </div>
          </section>

          {/* Book Metadata */}
          {hasBookMeta && (provider as ProviderConfig).bookMetadata && (
            <section className="space-y-3">
              <SectionLabel>Book Metadata</SectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                {BOOK_META_TOGGLES.map(({ key, label }) => (
                  <Checkbox
                    key={key}
                    label={label}
                    checked={(provider as ProviderConfig).bookMetadata[key]}
                    onChange={(v) =>
                      onSave({ bookMetadata: { [key]: v } }, true)
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// ── Provider-specific fields ─────────────────────────────────────

function ProviderSpecificFields({
  providerKey,
  provider,
  globalConfig,
  envLocks,
  onSave,
  onSaveGlobal,
}: {
  providerKey: string
  provider: AnyProviderConfig
  globalConfig: MetadataProvidersConfig
  envLocks: KomfConfig['envLocks']
  onSave: (patch: Record<string, unknown>, immediate?: boolean) => void
  onSaveGlobal: (patch: Partial<MetadataProvidersConfig>, immediate?: boolean) => void
}) {
  if (providerKey === 'mal') {
    const locked = envLocks.malClientId
    return (
      <section className="space-y-3">
        <SectionLabel>MyAnimeList Settings</SectionLabel>
        {locked && <EnvManagedHint envName="KOMF_METADATA_PROVIDERS_MAL_CLIENT_ID" />}
        <TextField
          label="MAL Client ID"
          value={globalConfig.malClientId ?? ''}
          placeholder="Your MyAnimeList API client ID"
          description="Required to use MAL as a metadata provider."
          disabled={locked}
          onChange={(v) => onSaveGlobal({ malClientId: v || null })}
        />
        <div className="rounded-lg border border-ink-800/30 bg-ink-950/20 px-4 py-3 text-xs text-ink-400 space-y-1.5">
          <p className="font-medium text-ink-300">How to get your MAL Client ID:</p>
          <p><strong className="text-ink-200">1.</strong> Go to{' '}
            <a href="https://myanimelist.net/apiconfig" target="_blank" rel="noopener noreferrer" className="text-accent-400 hover:text-accent-300">myanimelist.net/apiconfig</a>{' '}
            and log in</p>
          <p><strong className="text-ink-200">2.</strong> Click <strong className="text-ink-200">Create ID</strong> (or select an existing app)</p>
          <p><strong className="text-ink-200">3.</strong> Fill in any app name, set App Type to <strong className="text-ink-200">web</strong></p>
          <p><strong className="text-ink-200">4.</strong> Copy the <strong className="text-ink-200">Client ID</strong> value and paste it above</p>
        </div>
      </section>
    )
  }

  if (providerKey === 'comicVine') {
    const lockKey = envLocks.comicVineApiKey
    const lockSearch = envLocks.comicVineSearchLimit
    return (
      <section className="space-y-3">
        <SectionLabel>ComicVine Settings</SectionLabel>
        {(lockKey || lockSearch) && (
          <EnvManagedHint envName={lockKey && lockSearch ? 'KOMF_METADATA_PROVIDERS_COMIC_VINE_API_KEY / KOMF_METADATA_PROVIDERS_COMIC_VINE_SEARCH_LIMIT' : (lockKey ? 'KOMF_METADATA_PROVIDERS_COMIC_VINE_API_KEY' : 'KOMF_METADATA_PROVIDERS_COMIC_VINE_SEARCH_LIMIT')} />
        )}
        <TextField
          label="ComicVine API Key"
          value={globalConfig.comicVineClientId ?? ''}
          placeholder="Your ComicVine API key"
          description="Required to use ComicVine as a metadata provider."
          disabled={lockKey}
          onChange={(v) => onSaveGlobal({ comicVineClientId: v || null })}
        />
        <div className="rounded-lg border border-ink-800/30 bg-ink-950/20 px-4 py-3 text-xs text-ink-400 space-y-1.5">
          <p className="font-medium text-ink-300">How to get your ComicVine API Key:</p>
          <p><strong className="text-ink-200">1.</strong> Create a free account at{' '}
            <a href="https://comicvine.gamespot.com" target="_blank" rel="noopener noreferrer" className="text-accent-400 hover:text-accent-300">comicvine.gamespot.com</a></p>
          <p><strong className="text-ink-200">2.</strong> Go to{' '}
            <a href="https://comicvine.gamespot.com/api/" target="_blank" rel="noopener noreferrer" className="text-accent-400 hover:text-accent-300">comicvine.gamespot.com/api</a></p>
          <p><strong className="text-ink-200">3.</strong> Your API Key is shown at the top of the page — copy and paste it above</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NumberField
            label="Search Limit"
            value={globalConfig.comicVineSearchLimit}
            placeholder="e.g. 100"
            min={1}
            disabled={lockSearch}
            onChange={(v) => onSaveGlobal({ comicVineSearchLimit: v })}
          />
          <TextField
            label="Issue Name"
            value={globalConfig.comicVineIssueName ?? ''}
            placeholder="e.g. issue"
            onChange={(v) => onSaveGlobal({ comicVineIssueName: v || null })}
          />
          <TextField
            label="ID Format"
            value={globalConfig.comicVineIdFormat ?? ''}
            placeholder="e.g. 4050-%s"
            onChange={(v) => onSaveGlobal({ comicVineIdFormat: v || null })}
          />
        </div>
      </section>
    )
  }

  if (providerKey === 'aniList') {
    const p = provider as AniListConfig
    return (
      <section className="space-y-3">
        <SectionLabel>AniList Settings</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumberField
            label="Tags Score Threshold"
            value={p.tagsScoreThreshold}
            min={0}
            max={100}
            description="Minimum score (0–100) for tags."
            onChange={(v) => onSave({ tagsScoreThreshold: v ?? 60 })}
          />
          <NumberField
            label="Tags Size Limit"
            value={p.tagsSizeLimit}
            min={0}
            description="Maximum number of tags."
            onChange={(v) => onSave({ tagsSizeLimit: v ?? 15 })}
          />
        </div>
      </section>
    )
  }

  if (providerKey === 'mangaDex') {
    const p = provider as MangaDexConfig
    return (
      <section className="space-y-3">
        <SectionLabel>MangaDex Settings</SectionLabel>
        <TagListField
          label="Cover Languages"
          values={p.coverLanguages}
          placeholder="e.g. en, ja"
          description="Languages for cover images."
          onChange={(v) => onSave({ coverLanguages: v }, true)}
        />
        <MultiSelectField
          label="Links"
          values={p.links}
          options={MANGADEX_LINK_OPTIONS}
          description="External links to include in metadata."
          onChange={(v) => onSave({ links: v }, true)}
        />
      </section>
    )
  }

  if (providerKey === 'mangaBaka') {
    const p = provider as MangaBakaConfig
    return (
      <section className="space-y-3">
        <SectionLabel>MangaBaka Settings</SectionLabel>
        <SelectField
          label="Mode"
          value={p.mode}
          options={MANGABAKA_MODE_OPTIONS}
          description="API queries live; Database uses a local copy."
          onChange={(v) => onSave({ mode: v }, true)}
        />
      </section>
    )
  }

  return null
}

// ── Small helpers ────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
      {children}
    </h4>
  )
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-ink-800/30"
    >
      <div
        className={clsx(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          checked
            ? 'border-accent-500 bg-accent-600'
            : 'border-ink-600 bg-ink-950/50',
        )}
      >
        {checked && <Check className="h-3 w-3 text-white" />}
      </div>
      <span className="text-sm text-ink-300">{label}</span>
    </button>
  )
}

function EnvManagedHint({ envName }: { envName: string }) {
  return (
    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
      Managed by environment variable: <span className="font-mono">{envName}</span>
    </p>
  )
}
