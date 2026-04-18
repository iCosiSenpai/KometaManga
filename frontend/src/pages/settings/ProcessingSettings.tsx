import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  api,
  KomfConfig,
  KomfMediaType,
  KomfReadingDirection,
  KomfUpdateMode,
  MetadataProcessingConfig,
  MetadataProcessingConfigUpdateRequest,
  PublisherTagName,
} from '@/api/client'
import { useAutoSave } from '@/hooks/useAutoSave'
import { ConfirmDialog, useConfirm } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { PageSpinner } from '@/components/Spinner'
import { ErrorState } from '@/components/ErrorState'
import {
  SettingsSection,
  TextField,
  ToggleField,
  SelectField,
  MultiSelectField,
  TagListField,
  SaveIndicator,
} from '@/components/settings/SettingsFields'
import {
  Cog,
  Image,
  Wand2,
  BookOpen,
  Layers,
  FileText,
  Library as LibraryIcon,
  Sparkles,
} from 'lucide-react'
import { clsx } from 'clsx'

// ── Presets ──────────────────────────────────────────────────────

interface ProcessingPreset {
  label: string
  description: string
  config: MetadataProcessingConfigUpdateRequest
}

const PRESETS: ProcessingPreset[] = [
  {
    label: 'Manga (Standard)',
    description: 'Right-to-left, API + ComicInfo, covers enabled',
    config: {
      libraryType: 'MANGA',
      aggregate: true,
      mergeTags: true,
      mergeGenres: true,
      bookCovers: false,
      seriesCovers: true,
      overrideExistingCovers: false,
      lockCovers: false,
      updateModes: ['API', 'COMIC_INFO'],
      postProcessing: {
        seriesTitle: true,
        orderBooks: true,
        readingDirectionValue: 'RIGHT_TO_LEFT',
        fallbackToAltTitle: true,
      },
    },
  },
  {
    label: 'Webtoon',
    description: 'Vertical scroll, API mode, covers enabled',
    config: {
      libraryType: 'WEBTOON',
      aggregate: true,
      mergeTags: true,
      mergeGenres: true,
      bookCovers: false,
      seriesCovers: true,
      overrideExistingCovers: false,
      lockCovers: false,
      updateModes: ['API'],
      postProcessing: {
        seriesTitle: true,
        orderBooks: true,
        readingDirectionValue: 'WEBTOON',
        fallbackToAltTitle: true,
      },
    },
  },
  {
    label: 'Comics (Western)',
    description: 'Left-to-right, ComicInfo, lock covers',
    config: {
      libraryType: 'COMIC',
      aggregate: false,
      mergeTags: false,
      mergeGenres: false,
      bookCovers: true,
      seriesCovers: true,
      overrideExistingCovers: false,
      lockCovers: true,
      updateModes: ['COMIC_INFO'],
      postProcessing: {
        seriesTitle: true,
        orderBooks: true,
        readingDirectionValue: 'LEFT_TO_RIGHT',
        fallbackToAltTitle: false,
      },
    },
  },
  {
    label: 'Light Novel',
    description: 'Novel type, right-to-left, no covers',
    config: {
      libraryType: 'NOVEL',
      aggregate: true,
      mergeTags: true,
      mergeGenres: true,
      bookCovers: false,
      seriesCovers: false,
      overrideExistingCovers: false,
      lockCovers: false,
      updateModes: ['API'],
      postProcessing: {
        seriesTitle: true,
        orderBooks: true,
        readingDirectionValue: 'RIGHT_TO_LEFT',
        fallbackToAltTitle: true,
      },
    },
  },
]

const MEDIA_TYPE_OPTIONS: { value: KomfMediaType; label: string }[] = [
  { value: 'MANGA', label: 'Manga' },
  { value: 'NOVEL', label: 'Novel' },
  { value: 'COMIC', label: 'Comic' },
  { value: 'WEBTOON', label: 'Webtoon' },
]

const READING_DIR_OPTIONS: { value: KomfReadingDirection | ''; label: string }[] = [
  { value: '', label: 'None (no override)' },
  { value: 'LEFT_TO_RIGHT', label: 'Left to Right' },
  { value: 'RIGHT_TO_LEFT', label: 'Right to Left' },
  { value: 'VERTICAL', label: 'Vertical' },
  { value: 'WEBTOON', label: 'Webtoon' },
]

const UPDATE_MODE_OPTIONS: { value: KomfUpdateMode; label: string }[] = [
  { value: 'API', label: 'API' },
  { value: 'COMIC_INFO', label: 'ComicInfo' },
]

export function ProcessingSettings() {
  const configQuery = useQuery({ queryKey: ['config'], queryFn: api.getConfig })
  const librariesQuery = useQuery({ queryKey: ['libraries'], queryFn: api.getLibraries })

  if (configQuery.isLoading) return <PageSpinner />
  if (configQuery.isError)
    return <ErrorState message="Failed to load config" onRetry={() => configQuery.refetch()} />

  return (
    <ProcessingForm
      config={configQuery.data!}
      libraries={librariesQuery.data ?? []}
    />
  )
}

function ProcessingForm({
  config,
  libraries,
}: {
  config: KomfConfig
  libraries: { id: string; name: string }[]
}) {
  const { status, error, save, dismissError } = useAutoSave()
  const { confirm, dialogProps } = useConfirm()
  const [activeTab, setActiveTab] = useState<'default' | string>('default')

  const libraryOverrides = config.komga.metadataUpdate.library
  const libraryIds = Object.keys(libraryOverrides)

  // Send a processing config update for either default or library-specific
  function saveProcessing(
    patch: MetadataProcessingConfigUpdateRequest,
    immediate = false,
  ) {
    if (activeTab === 'default') {
      save({ komga: { metadataUpdate: { default: patch } } }, immediate)
    } else {
      save(
        { komga: { metadataUpdate: { library: { [activeTab]: patch } } } },
        immediate,
      )
    }
  }

  const currentConfig =
    activeTab === 'default'
      ? config.komga.metadataUpdate.default
      : libraryOverrides[activeTab] ?? config.komga.metadataUpdate.default

  return (
    <div className="animate-fade-in">
      <ConfirmDialog {...dialogProps} />
      <PageHeader
        title="Processing"
        description="Configure how metadata is processed and applied to your libraries."
      />

      {/* Presets */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-300">
          <Sparkles className="h-4 w-4 text-accent-400" />
          Quick Presets
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                confirm(`Apply "${preset.label}" preset to ${activeTab === 'default' ? 'default' : 'current library'} settings?`, () =>
                  saveProcessing(preset.config, true))
              }}
              className="rounded-lg border border-ink-800/50 bg-ink-900/30 px-3 py-1.5 text-xs text-ink-300 transition-colors hover:border-accent-600/30 hover:bg-ink-800/40 hover:text-ink-100"
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Config summary chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        <SummaryChip
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="Type"
          value={currentConfig.libraryType}
        />
        <SummaryChip
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Aggregate"
          value={currentConfig.aggregate ? 'On' : 'Off'}
          active={currentConfig.aggregate}
        />
        <SummaryChip
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Modes"
          value={currentConfig.updateModes.join(' + ')}
        />
        <SummaryChip
          icon={<Image className="h-3.5 w-3.5" />}
          label="Covers"
          value={
            [currentConfig.seriesCovers && 'Series', currentConfig.bookCovers && 'Book']
              .filter(Boolean)
              .join(' + ') || 'Off'
          }
          active={currentConfig.seriesCovers || currentConfig.bookCovers}
        />
      </div>

      {/* Tab bar: Default + per-library overrides */}
      <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-xl border border-ink-800/50 bg-ink-900/30 p-1">
        <TabButton
          active={activeTab === 'default'}
          onClick={() => setActiveTab('default')}
          label="Defaults"
          icon={<Cog className="h-3.5 w-3.5" />}
        />
        {libraries.map((lib) => (
          <TabButton
            key={lib.id}
            active={activeTab === lib.id}
            onClick={() => setActiveTab(lib.id)}
            label={lib.name}
            icon={<LibraryIcon className="h-3.5 w-3.5" />}
            hasOverride={libraryIds.includes(lib.id)}
          />
        ))}
      </div>

      <div className="space-y-6">
        <ProcessingConfigFields
          config={currentConfig}
          onSave={saveProcessing}
          status={status}
          error={error}
          onDismissError={dismissError}
        />
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  label,
  icon,
  hasOverride,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon?: React.ReactNode
  hasOverride?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-ink-800 text-ink-100'
          : 'text-ink-400 hover:bg-ink-800/50 hover:text-ink-200',
      )}
    >
      {icon}
      {label}
      {hasOverride && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent-500" />
      )}
    </button>
  )
}

function SummaryChip({
  icon,
  label,
  value,
  active,
}: {
  icon: React.ReactNode
  label: string
  value: string
  active?: boolean
}) {
  return (
    <div
      className={clsx(
        'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs',
        active === false
          ? 'border-ink-800/30 bg-ink-900/30 text-ink-500'
          : 'border-ink-800/50 bg-ink-900/50 text-ink-300',
      )}
    >
      <span className={clsx(active === false ? 'text-ink-600' : 'text-accent-400')}>{icon}</span>
      <span className="text-ink-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function ProcessingConfigFields({
  config,
  onSave,
  status,
  error,
  onDismissError,
}: {
  config: MetadataProcessingConfig
  onSave: (patch: MetadataProcessingConfigUpdateRequest, immediate?: boolean) => void
  status: 'idle' | 'saving' | 'saved' | 'error'
  error: string | null
  onDismissError: () => void
}) {
  return (
    <>
      {/* General */}
      <SettingsSection
        title="General"
        description="Base processing behavior."
        icon={<Cog className="h-5 w-5 text-accent-400" />}
        action={<SaveIndicator status={status} error={error} onDismiss={onDismissError} />}
      >
        <SelectField
          label="Library Type"
          value={config.libraryType}
          options={MEDIA_TYPE_OPTIONS}
          description="Default media type for metadata matching."
          onChange={(v) => onSave({ libraryType: v }, true)}
        />

        <ToggleField
          label="Aggregate Metadata"
          checked={config.aggregate}
          description="Combine metadata from multiple providers."
          onChange={(v) => onSave({ aggregate: v }, true)}
        />

        <ToggleField
          label="Merge Tags"
          checked={config.mergeTags}
          description="Merge tags from all providers instead of using only the first."
          onChange={(v) => onSave({ mergeTags: v }, true)}
        />

        <ToggleField
          label="Merge Genres"
          checked={config.mergeGenres}
          description="Merge genres from all providers."
          onChange={(v) => onSave({ mergeGenres: v }, true)}
        />

        <MultiSelectField
          label="Update Modes"
          values={config.updateModes}
          options={UPDATE_MODE_OPTIONS}
          description="How metadata is written to Komga."
          onChange={(v) => onSave({ updateModes: v }, true)}
        />
      </SettingsSection>

      {/* Covers */}
      <SettingsSection title="Covers" description="Cover image processing options." icon={<Image className="h-5 w-5 text-violet-400" />}>
        <ToggleField
          label="Series Covers"
          checked={config.seriesCovers}
          description="Update series cover images from providers."
          onChange={(v) => onSave({ seriesCovers: v }, true)}
        />

        <ToggleField
          label="Book Covers"
          checked={config.bookCovers}
          description="Update individual book cover images."
          onChange={(v) => onSave({ bookCovers: v }, true)}
        />

        <ToggleField
          label="Override Existing Covers"
          checked={config.overrideExistingCovers}
          description="Replace covers even when they already exist."
          onChange={(v) => onSave({ overrideExistingCovers: v }, true)}
        />

        <ToggleField
          label="Lock Covers"
          checked={config.lockCovers}
          description="Prevent Komga from overwriting updated covers on rescan."
          onChange={(v) => onSave({ lockCovers: v }, true)}
        />
      </SettingsSection>

      {/* Post-processing */}
      <SettingsSection
        title="Post-Processing"
        description="Adjust metadata after provider matching."
        icon={<Wand2 className="h-5 w-5 text-emerald-400" />}
      >
        <ToggleField
          label="Update Series Title"
          checked={config.postProcessing.seriesTitle}
          description="Set the series title from provider data."
          onChange={(v) => onSave({ postProcessing: { seriesTitle: v } }, true)}
        />

        <TextField
          label="Series Title Language"
          value={config.postProcessing.seriesTitleLanguage ?? ''}
          placeholder="e.g. en, ja, romaji"
          description="Preferred language for series title. Empty uses default."
          onChange={(v) =>
            onSave({ postProcessing: { seriesTitleLanguage: v || null } })
          }
        />

        <ToggleField
          label="Alternative Series Titles"
          checked={config.postProcessing.alternativeSeriesTitles ?? false}
          description="Include alternative titles in metadata."
          onChange={(v) =>
            onSave({ postProcessing: { alternativeSeriesTitles: v } }, true)
          }
        />

        <TagListField
          label="Alternative Title Languages"
          values={config.postProcessing.alternativeSeriesTitleLanguages}
          placeholder="e.g. en, ja, ja-ro"
          description="Languages to include for alternative titles."
          onChange={(v) =>
            onSave({ postProcessing: { alternativeSeriesTitleLanguages: v } }, true)
          }
        />

        <ToggleField
          label="Fallback to Alt Title"
          checked={config.postProcessing.fallbackToAltTitle}
          description="Use an alternative title if the preferred language is unavailable."
          onChange={(v) =>
            onSave({ postProcessing: { fallbackToAltTitle: v } }, true)
          }
        />

        <ToggleField
          label="Order Books"
          checked={config.postProcessing.orderBooks}
          description="Automatically set book sort numbers."
          onChange={(v) => onSave({ postProcessing: { orderBooks: v } }, true)}
        />

        <SelectField<KomfReadingDirection | ''>
          label="Reading Direction"
          value={config.postProcessing.readingDirectionValue ?? ''}
          options={READING_DIR_OPTIONS}
          description="Override reading direction for the series. 'None' to not override."
          onChange={(v) =>
            onSave(
              { postProcessing: { readingDirectionValue: (v as KomfReadingDirection) || null } },
              true,
            )
          }
        />

        <TextField
          label="Language"
          value={config.postProcessing.languageValue ?? ''}
          placeholder="e.g. en"
          description="Override language value for all series."
          onChange={(v) =>
            onSave({ postProcessing: { languageValue: v || null } })
          }
        />

        <TextField
          label="Score Tag Name"
          value={config.postProcessing.scoreTagName ?? ''}
          placeholder="e.g. score"
          description="Tag name used to store provider scores."
          onChange={(v) =>
            onSave({ postProcessing: { scoreTagName: v || null } })
          }
        />

        <TextField
          label="Original Publisher Tag Name"
          value={config.postProcessing.originalPublisherTagName ?? ''}
          placeholder="e.g. original_publisher"
          description="Tag name for the original (Japanese) publisher."
          onChange={(v) =>
            onSave({ postProcessing: { originalPublisherTagName: v || null } })
          }
        />

        <PublisherTagNamesEditor
          values={config.postProcessing.publisherTagNames}
          onSave={(v) => onSave({ postProcessing: { publisherTagNames: v } }, true)}
        />
      </SettingsSection>
    </>
  )
}

// --- Publisher Tag Names editor (array of {tagName, language}) ---

function PublisherTagNamesEditor({
  values,
  onSave,
}: {
  values: PublisherTagName[]
  onSave: (v: PublisherTagName[]) => void
}) {
  const [newTag, setNewTag] = useState('')
  const [newLang, setNewLang] = useState('')

  function handleAdd() {
    const tag = newTag.trim()
    const lang = newLang.trim()
    if (!tag || !lang) return
    onSave([...values, { tagName: tag, language: lang }])
    setNewTag('')
    setNewLang('')
  }

  function handleRemove(index: number) {
    onSave(values.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-ink-300">
        Publisher Tag Names
        <span className="ml-2 text-xs text-ink-500">
          Map language codes to publisher tag names
        </span>
      </label>

      {values.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <code className="rounded bg-ink-800 px-2 py-1 text-xs text-ink-300">
            {item.language}
          </code>
          <span className="text-xs text-ink-500">→</span>
          <code className="flex-1 rounded bg-ink-800 px-2 py-1 text-xs text-ink-300">
            {item.tagName}
          </code>
          <button
            onClick={() => handleRemove(i)}
            className="rounded-md p-1 text-ink-500 hover:bg-red-500/10 hover:text-red-400"
            aria-label={`Remove ${item.tagName}`}
          >
            ×
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newLang}
          onChange={(e) => setNewLang(e.target.value)}
          placeholder="lang (e.g. ko)"
          className="w-24 rounded-lg border border-dashed border-ink-700 bg-ink-950/30 px-2 py-1.5 text-xs text-ink-100 placeholder-ink-600 focus:border-accent-500 focus:outline-none"
        />
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="tag name (e.g. korean_publisher)"
          className="flex-1 rounded-lg border border-dashed border-ink-700 bg-ink-950/30 px-2 py-1.5 text-xs text-ink-100 placeholder-ink-600 focus:border-accent-500 focus:outline-none"
        />
        <button
          onClick={handleAdd}
          disabled={!newTag.trim() || !newLang.trim()}
          className="rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-xs font-medium text-ink-300 hover:bg-ink-700 disabled:opacity-40"
        >
          + Add
        </button>
      </div>
    </div>
  )
}
