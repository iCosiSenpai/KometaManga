import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, KomfConfig, DownloadTarget } from '@/api/client'
import { useAutoSave } from '@/hooks/useAutoSave'
import { PageHeader } from '@/components/PageHeader'
import { PageSpinner } from '@/components/Spinner'
import { ErrorState } from '@/components/ErrorState'
import {
  SettingsSection,
  ToggleField,
  NumberField,
  TextField,
  SaveIndicator,
} from '@/components/settings/SettingsFields'
import { CheckCircle2, XCircle, Loader2, FolderOpen, Library, Plus, Trash2, Pencil, Star } from 'lucide-react'
import { clsx } from 'clsx'

function EnvManagedHint({ envName }: { envName: string }) {
  return (
    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
      Managed by environment variable: <span className="font-mono">{envName}</span>
    </p>
  )
}

export function DownloadSettings() {
  const configQuery = useQuery({ queryKey: ['config'], queryFn: api.getConfig })
  if (configQuery.isLoading) return <PageSpinner />
  if (configQuery.isError)
    return <ErrorState message="Failed to load config" onRetry={() => configQuery.refetch()} />
  return <DownloadForm config={configQuery.data!} />
}

function DownloadForm({ config }: { config: KomfConfig }) {
  const { status, error, save, dismissError } = useAutoSave()
  const locks = config.envLocks
  const dl = config.download ?? {
    downloadDir: '/data',
    komgaLibraryId: null,
    komgaLibraryPath: null,
    autoScanAfterDownload: true,
    cbzCompression: false,
    concurrentPageDownloads: 5,
    extraTargets: [],
  }
  const extraTargets = dl.extraTargets ?? []

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Download Config"
        description="Configure the download pipeline — target library, packaging, and Komga import."
      />
      <SaveIndicator status={status} error={error} onDismiss={dismissError} />

      <div className="mt-6 space-y-6">
        <SettingsSection
          title="Download Targets"
          description="Where chapters are stored. Use the same mount paths as Komga (e.g. /data) so both containers share the same library tree."
        >
          <DownloadTargetsSection
            dl={dl}
            locks={locks}
            extraTargets={extraTargets}
            onSave={(patch) => save({ download: { ...dl, ...patch } })}
          />
        </SettingsSection>

        <SettingsSection title="CBZ Packaging" description="How chapter images are bundled into archives.">
          {locks.downloadCbzCompression && <EnvManagedHint envName="KOMF_DOWNLOAD_CBZ_COMPRESSION" />}
          <ToggleField
            label="Enable CBZ compression"
            description="When off, uses STORE mode (no compression, faster). When on, uses DEFLATE."
            checked={dl.cbzCompression}
            disabled={!!locks.downloadCbzCompression}
            onChange={(v) => save({ download: { ...dl, cbzCompression: v } })}
          />
          {locks.downloadConcurrentPages && <EnvManagedHint envName="KOMF_DOWNLOAD_CONCURRENT_PAGES" />}
          <NumberField
            label="Concurrent page downloads"
            description="Number of pages to download in parallel per chapter."
            value={dl.concurrentPageDownloads}
            min={1}
            max={20}
            disabled={!!locks.downloadConcurrentPages}
            onChange={(v) =>
              save({ download: { ...dl, concurrentPageDownloads: v ?? 5 } })
            }
          />
        </SettingsSection>

        <SettingsSection title="Komga Import" description="Automatic library scan after download completion.">
          {locks.downloadAutoScan && <EnvManagedHint envName="KOMF_DOWNLOAD_AUTO_SCAN" />}
          <ToggleField
            label="Auto-scan after download"
            description="Trigger a Komga library scan when a chapter finishes downloading."
            checked={dl.autoScanAfterDownload}
            disabled={!!locks.downloadAutoScan}
            onChange={(v) =>
              save({ download: { ...dl, autoScanAfterDownload: v } })
            }
          />
        </SettingsSection>
      </div>
    </div>
  )
}

/* ─── Unified download targets section ─── */

function DownloadTargetsSection({
  dl,
  locks,
  extraTargets,
  onSave,
}: {
  dl: NonNullable<import('@/api/client').KomfConfig['download']>
  locks: import('@/api/client').KomfConfig['envLocks']
  extraTargets: DownloadTarget[]
  onSave: (patch: Partial<NonNullable<import('@/api/client').KomfConfig['download']>>) => void
}) {
  const [editingDefault, setEditingDefault] = useState(false)
  const librariesQuery = useQuery({
    queryKey: ['libraries'],
    queryFn: api.getLibraries,
    staleTime: 60_000 * 5,
    retry: 1,
  })
  const libraries = librariesQuery.data ?? []
  const defaultLib = libraries.find((l) => l.id === dl.komgaLibraryId)

  return (
    <div className="space-y-3">
      {/* Default target card */}
      <div className="rounded-xl border border-ink-800/50 bg-ink-900/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Star className="h-3.5 w-3.5 text-accent-400" />
              <span className="text-sm font-semibold text-ink-100">Default</span>
            </div>
            {defaultLib && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-400">
                <Library className="h-3 w-3" />
                Komga: {defaultLib.name}
              </p>
            )}
            <p className="mt-0.5 truncate font-mono text-[11px] text-ink-500">
              {dl.downloadDir}
            </p>
          </div>
          <button
            onClick={() => setEditingDefault((v) => !v)}
            className="text-ink-400 hover:text-ink-200"
            title="Edit default target"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        {editingDefault && (
          <div className="mt-4 space-y-3 border-t border-ink-800/40 pt-4">
            {locks.downloadDir && <EnvManagedHint envName="KOMF_DOWNLOAD_DIR" />}
            <KomgaLibraryPicker
              selectedLibraryId={dl.komgaLibraryId ?? null}
              onSelect={(libId, libPath) =>
                onSave({
                  komgaLibraryId: libId,
                  komgaLibraryPath: libPath,
                  downloadDir: libPath ?? dl.downloadDir,
                })
              }
            />
            <TextField
              label="Container path"
              value={dl.downloadDir}
              disabled={!!locks.downloadDir}
              placeholder="/data"
              description="Path inside the container where chapters are saved. Should match a Komga library mount (e.g. /data/manga)."
              onChange={(v) => onSave({ downloadDir: v })}
            />
            <DirTester path={dl.downloadDir} />
          </div>
        )}
      </div>

      {/* Extra target cards */}
      {extraTargets.map((t) => {
        const lib = libraries.find((l) => l.id === t.komgaLibraryId)
        return (
          <div
            key={t.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-ink-800/50 bg-ink-900/40 p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-100">{t.name}</p>
              {lib && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-400">
                  <Library className="h-3 w-3" />
                  Komga: {lib.name}
                </p>
              )}
              <p className="mt-0.5 truncate font-mono text-[11px] text-ink-500">
                {t.containerPath}
              </p>
            </div>
            <button
              onClick={() => onSave({ extraTargets: extraTargets.filter((x) => x.id !== t.id) })}
              className="text-ink-500 hover:text-red-400"
              title="Remove target"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      })}

      {/* Add target form */}
      <AddTargetForm
        libraries={libraries}
        onAdd={(target) => onSave({ extraTargets: [...extraTargets, target] })}
      />
    </div>
  )
}

function AddTargetForm({
  libraries,
  onAdd,
}: {
  libraries: import('@/api/client').Library[]
  onAdd: (target: DownloadTarget) => void
}) {
  const [name, setName] = useState('')
  const [libId, setLibId] = useState<string | null>(null)
  const [containerPath, setContainerPath] = useState('')

  const canAdd = name.trim() !== '' && containerPath.trim() !== ''

  function handleAdd() {
    if (!canAdd) return
    const lib = libraries.find((l) => l.id === libId)
    onAdd({
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: name.trim(),
      containerPath: containerPath.trim(),
      komgaLibraryId: lib?.id ?? null,
      komgaLibraryPath: lib?.roots[0] ?? null,
    })
    setName('')
    setLibId(null)
    setContainerPath('')
  }

  return (
    <div className="rounded-xl border border-dashed border-ink-800/60 bg-ink-900/20 p-4">
      <p className="mb-3 text-xs font-medium text-ink-400">Add extra target</p>
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Name (e.g. Webtoon, Light Novels, Comics)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-ink-800 bg-ink-950/60 px-3 py-2 text-sm text-ink-100 placeholder-ink-600 outline-none focus:border-accent-500"
        />

        {libraries.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {libraries.map((lib) => {
              const isSelected = libId === lib.id
              return (
                <button
                  key={lib.id}
                  type="button"
                  onClick={() => {
                    const next = isSelected ? null : lib.id
                    setLibId(next)
                    if (next && !containerPath.trim()) {
                      setContainerPath(lib.roots[0] ?? '')
                    }
                  }}
                  className={clsx(
                    'rounded-md px-2.5 py-1 text-xs transition-colors',
                    isSelected
                      ? 'bg-accent-600/20 text-accent-300 ring-1 ring-accent-500/30'
                      : 'bg-ink-800/50 text-ink-400 hover:bg-ink-800 hover:text-ink-200',
                  )}
                >
                  {lib.name}
                </button>
              )
            })}
          </div>
        )}

        <input
          type="text"
          placeholder="Container path (e.g. /data/webtoon)"
          value={containerPath}
          onChange={(e) => setContainerPath(e.target.value)}
          className="w-full rounded-lg border border-ink-800 bg-ink-950/60 px-3 py-2 font-mono text-xs text-ink-100 placeholder-ink-600 outline-none focus:border-accent-500"
        />

        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            canAdd
              ? 'bg-accent-600 text-white hover:bg-accent-500'
              : 'cursor-not-allowed bg-ink-800/50 text-ink-600',
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          Add target
        </button>
      </div>
    </div>
  )
}

/* ─── Directory tester ─── */
type DirResult = { exists: boolean; writable: boolean; fileCount: number; sampleFiles: string[] }

function DirTester({ path }: { path: string }) {
  const [result, setResult] = useState<DirResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-validate when path changes (debounced)
  useEffect(() => {
    if (!path.trim()) { setResult(null); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await api.validateDir(path)
        setResult(r)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Validation failed')
        setResult(null)
      } finally {
        setLoading(false)
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [path])

  if (!path.trim()) return null

  return (
    <div className="mt-2 rounded-lg border border-ink-800/40 bg-ink-900/30 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-400">
        <FolderOpen className="h-3.5 w-3.5" />
        Directory Status
      </div>
      {loading && (
        <div className="mt-2 flex items-center gap-2 text-xs text-ink-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking…
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
      {result && !loading && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            {result.exists ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-400" />
            )}
            <span className={clsx(result.exists ? 'text-emerald-400' : 'text-red-400')}>
              {result.exists ? 'Directory exists' : 'Directory not found'}
            </span>
          </div>
          {result.exists && (
            <>
              <div className="flex items-center gap-2 text-xs">
                {result.writable ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-amber-400" />
                )}
                <span className={clsx(result.writable ? 'text-emerald-400' : 'text-amber-400')}>
                  {result.writable ? 'Writable' : 'Read-only'}
                </span>
              </div>
              <p className="text-xs text-ink-500">
                {result.fileCount} item{result.fileCount !== 1 ? 's' : ''}
                {result.sampleFiles.length > 0 && (
                  <span className="ml-1 text-ink-600">
                    ({result.sampleFiles.join(', ')}{result.fileCount > 5 ? ', …' : ''})
                  </span>
                )}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Komga Library Picker — primary target selection ─── */

function KomgaLibraryPicker({
  selectedLibraryId,
  onSelect,
}: {
  selectedLibraryId: string | null
  onSelect: (libraryId: string | null, libraryPath: string | null) => void
}) {
  const librariesQuery = useQuery({
    queryKey: ['libraries'],
    queryFn: api.getLibraries,
    staleTime: 60_000 * 5,
    retry: 1,
  })

  const libraries = librariesQuery.data ?? []

  if (librariesQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-ink-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading Komga libraries…
      </div>
    )
  }

  if (libraries.length === 0) {
    return (
      <p className="text-xs text-ink-500">
        No Komga libraries detected. Connect Komga first, then come back to pick a target library.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-500">
        Pick the Komga library where chapters will be downloaded. Each library points to a folder on disk.
      </p>
      <div className="flex flex-wrap gap-2">
        {libraries.map((lib) => {
          const rootPath = lib.roots[0] ?? null
          const isSelected = selectedLibraryId === lib.id
          return (
            <button
              key={lib.id}
              onClick={() => onSelect(isSelected ? null : lib.id, isSelected ? null : rootPath)}
              className={clsx(
                'flex flex-col items-start rounded-lg px-4 py-2.5 text-left transition-all',
                isSelected
                  ? 'bg-accent-600/20 text-accent-400 ring-1 ring-accent-500/30'
                  : 'bg-ink-800/40 text-ink-400 hover:bg-ink-800/60 hover:text-ink-200',
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Library className="h-3.5 w-3.5" />
                {lib.name}
              </span>
              {rootPath && (
                <span className="mt-0.5 text-[11px] text-ink-500">{rootPath}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}