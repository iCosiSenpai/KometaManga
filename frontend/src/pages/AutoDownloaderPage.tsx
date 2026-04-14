import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type {
  AutoDownloaderRuleDto,
  MangaSourceId,
  CreateAutoDownloaderRuleDto,
  UpdateAutoDownloaderRuleDto,
  MangaSearchResultDto,
} from '@/api/sources'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'
import {
  RefreshCw,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Clock,
  Search,
  X,
  Edit3,
  Check,
} from 'lucide-react'
import { clsx } from 'clsx'

export function AutoDownloaderPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Status
  const statusQuery = useQuery({
    queryKey: ['auto-downloader-status'],
    queryFn: api.getAutoDownloaderStatus,
    refetchInterval: 30_000,
  })

  // Rules
  const rulesQuery = useQuery({
    queryKey: ['auto-downloader-rules'],
    queryFn: api.getAutoDownloaderRules,
  })

  // Check now
  const checkNowMutation = useMutation({
    mutationFn: api.autoDownloaderCheckNow,
    onSuccess: () => {
      toast('Check started', 'success')
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-status'] })
    },
    onError: (err: Error) => {
      toast(err.message || 'Check failed', 'error')
    },
  })

  // Create rule
  const createMutation = useMutation({
    mutationFn: api.createAutoDownloaderRule,
    onSuccess: () => {
      toast('Rule created', 'success')
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-rules'] })
      setShowCreate(false)
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to create rule', 'error')
    },
  })

  // Update rule
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAutoDownloaderRuleDto }) =>
      api.updateAutoDownloaderRule(id, body),
    onSuccess: () => {
      toast('Rule updated', 'success')
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-rules'] })
      setEditingId(null)
    },
  })

  // Delete rule
  const deleteMutation = useMutation({
    mutationFn: api.deleteAutoDownloaderRule,
    onSuccess: () => {
      toast('Rule deleted', 'success')
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-rules'] })
    },
  })

  // Toggle rule enabled
  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.updateAutoDownloaderRule(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-rules'] })
    },
  })

  const status = statusQuery.data
  const rules = rulesQuery.data ?? []

  return (
    <div className="animate-page-in">
      <PageHeader
        title="Auto-Downloader"
        description="Automatically download new chapters for tracked manga"
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => checkNowMutation.mutate()}
              loading={checkNowMutation.isPending}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Check Now
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add Rule
            </Button>
          </div>
        }
      />

      {/* Status card */}
      {status && (
        <Card variant="subtle" className="mb-6">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              {status.enabled ? (
                <Power className="h-4 w-4 text-emerald-400" />
              ) : (
                <PowerOff className="h-4 w-4 text-red-400" />
              )}
              <span className={status.enabled ? 'text-emerald-400' : 'text-red-400'}>
                {status.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-ink-400">
              <Clock className="h-3.5 w-3.5" />
              Last check: {status.lastCheck ? formatDate(status.lastCheck) : 'Never'}
            </div>
            {status.nextCheck && (
              <div className="flex items-center gap-2 text-ink-400">
                <Clock className="h-3.5 w-3.5" />
                Next: {formatDate(status.nextCheck)}
              </div>
            )}
            <span className="text-ink-500">
              {status.activeRulesCount} active rule{status.activeRulesCount !== 1 ? 's' : ''}
            </span>
          </div>
        </Card>
      )}

      {/* Create rule form */}
      {showCreate && (
        <CreateRuleForm
          onSubmit={(dto) => createMutation.mutate(dto)}
          onCancel={() => setShowCreate(false)}
          loading={createMutation.isPending}
        />
      )}

      {/* Rules list */}
      {rulesQuery.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {rulesQuery.isError && (
        <ErrorState
          message="Failed to load rules"
          onRetry={() => rulesQuery.refetch()}
        />
      )}

      {rulesQuery.isSuccess && rules.length === 0 && !showCreate && (
        <EmptyState
          icon={<RefreshCw className="h-6 w-6" />}
          title="No auto-download rules"
          description="Add a rule to automatically download new chapters"
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add Rule
            </Button>
          }
        />
      )}

      {rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={(enabled) =>
                toggleMutation.mutate({ id: rule.id, enabled })
              }
              onDelete={() => {
                if (confirm(`Delete rule "${rule.mangaTitle}"?`)) {
                  deleteMutation.mutate(rule.id)
                }
              }}
              onUpdate={(body) =>
                updateMutation.mutate({ id: rule.id, body })
              }
              isEditing={editingId === rule.id}
              onEditToggle={() =>
                setEditingId(editingId === rule.id ? null : rule.id)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── RuleCard ──

function RuleCard({
  rule,
  onToggle,
  onDelete,
  onUpdate,
  isEditing,
  onEditToggle,
}: {
  rule: AutoDownloaderRuleDto
  onToggle: (enabled: boolean) => void
  onDelete: () => void
  onUpdate: (body: UpdateAutoDownloaderRuleDto) => void
  isEditing: boolean
  onEditToggle: () => void
}) {
  const [editLang, setEditLang] = useState(rule.language ?? '')
  const [editScanlator, setEditScanlator] = useState(rule.scanlator ?? '')
  const [editLastChapter, setEditLastChapter] = useState(
    rule.lastChapterNumber?.toString() ?? '',
  )

  return (
    <Card
      variant="subtle"
      className={clsx(!rule.enabled && 'opacity-60')}
    >
      <div className="flex items-start gap-4">
        {/* Toggle */}
        <button
          onClick={() => onToggle(!rule.enabled)}
          className={clsx(
            'mt-1 shrink-0 rounded-full p-1 transition-colors',
            rule.enabled
              ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
              : 'bg-ink-800/40 text-ink-500 hover:bg-ink-800/60',
          )}
          title={rule.enabled ? 'Disable' : 'Enable'}
        >
          {rule.enabled ? (
            <Power className="h-3.5 w-3.5" />
          ) : (
            <PowerOff className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-ink-200">{rule.mangaTitle}</span>
            <span className="rounded bg-ink-800/60 px-1.5 py-0.5 text-[10px] font-medium uppercase text-ink-500">
              {rule.sourceId}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
            {rule.language && <span>Language: {rule.language.toUpperCase()}</span>}
            {rule.scanlator && <span>Scanlator: {rule.scanlator}</span>}
            {rule.lastChapterNumber != null && (
              <span>Last: Ch. {rule.lastChapterNumber}</span>
            )}
          </div>

          {/* Edit form */}
          {isEditing && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="text"
                value={editLang}
                onChange={(e) => setEditLang(e.target.value)}
                placeholder="Language"
                className="w-20 rounded-lg border border-ink-800/50 bg-ink-900/50 px-2 py-1 text-xs text-ink-200 outline-none focus:border-accent-600/50"
              />
              <input
                type="text"
                value={editScanlator}
                onChange={(e) => setEditScanlator(e.target.value)}
                placeholder="Scanlator"
                className="w-32 rounded-lg border border-ink-800/50 bg-ink-900/50 px-2 py-1 text-xs text-ink-200 outline-none focus:border-accent-600/50"
              />
              <input
                type="number"
                value={editLastChapter}
                onChange={(e) => setEditLastChapter(e.target.value)}
                placeholder="Last Ch."
                step="0.1"
                className="w-20 rounded-lg border border-ink-800/50 bg-ink-900/50 px-2 py-1 text-xs text-ink-200 outline-none focus:border-accent-600/50"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  onUpdate({
                    language: editLang || null,
                    scanlator: editScanlator || null,
                    lastChapterNumber: editLastChapter
                      ? parseFloat(editLastChapter)
                      : null,
                  })
                }
              >
                <Check className="h-3 w-3" />
                Save
              </Button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 gap-1">
          <button
            onClick={onEditToggle}
            className="rounded p-1.5 text-ink-500 transition-colors hover:bg-ink-800/50 hover:text-ink-300"
            title="Edit"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1.5 text-ink-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Card>
  )
}

// ── CreateRuleForm ──

function CreateRuleForm({
  onSubmit,
  onCancel,
  loading,
}: {
  onSubmit: (dto: CreateAutoDownloaderRuleDto) => void
  onCancel: () => void
  loading: boolean
}) {
  const [sourceId, setSourceId] = useState<MangaSourceId | ''>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedManga, setSelectedManga] = useState<MangaSearchResultDto | null>(null)
  const [language, setLanguage] = useState('')
  const [scanlator, setScanlator] = useState('')

  const sourcesQuery = useQuery({
    queryKey: ['manga-sources'],
    queryFn: api.getSources,
  })

  const searchResults = useQuery({
    queryKey: ['auto-dl-search', sourceId, searchTerm],
    queryFn: () => api.searchSource(sourceId as string, searchTerm, 10),
    enabled: !!sourceId && searchTerm.length >= 2,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim().length >= 2) setSearchTerm(searchQuery.trim())
  }

  const handleSubmit = () => {
    if (!sourceId || !selectedManga) return
    onSubmit({
      sourceId: sourceId as MangaSourceId,
      mangaId: selectedManga.id,
      mangaTitle: selectedManga.title,
      language: language || undefined,
      scanlator: scanlator || undefined,
    })
  }

  return (
    <Card className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-ink-100">New Rule</h3>
        <button onClick={onCancel} className="rounded p-1 text-ink-500 hover:text-ink-300">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Source select */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-400">Source</label>
          <select
            value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value as MangaSourceId)
              setSelectedManga(null)
              setSearchTerm('')
              setSearchQuery('')
            }}
            className="w-full rounded-lg border border-ink-800/50 bg-ink-900/50 px-3 py-2 text-sm text-ink-200 outline-none focus:border-accent-600/50"
          >
            <option value="">Select source…</option>
            {(sourcesQuery.data ?? []).map((s) => (
              <option key={s.sourceId} value={s.sourceId}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Manga search */}
        {sourceId && !selectedManga && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Manga</label>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search manga…"
                className="flex-1 rounded-lg border border-ink-800/50 bg-ink-900/50 px-3 py-2 text-sm text-ink-200 placeholder-ink-500 outline-none focus:border-accent-600/50"
              />
              <Button type="submit" size="sm" disabled={searchQuery.trim().length < 2}>
                <Search className="h-3.5 w-3.5" />
              </Button>
            </form>

            {/* Results */}
            {searchResults.data && searchResults.data.length > 0 && (
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-ink-800/50 bg-ink-900/50 p-1">
                {searchResults.data.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedManga(r)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink-300 transition-colors hover:bg-ink-800/50 hover:text-ink-100"
                  >
                    {r.coverUrl && (
                      <img
                        src={r.coverUrl}
                        alt=""
                        className="h-10 w-7 shrink-0 rounded object-cover"
                      />
                    )}
                    <span className="truncate">{r.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected manga */}
        {selectedManga && (
          <div className="flex items-center gap-3 rounded-lg border border-accent-800/30 bg-accent-950/10 px-3 py-2">
            {selectedManga.coverUrl && (
              <img
                src={selectedManga.coverUrl}
                alt=""
                className="h-10 w-7 shrink-0 rounded object-cover"
              />
            )}
            <span className="flex-1 truncate text-sm text-ink-200">
              {selectedManga.title}
            </span>
            <button
              onClick={() => {
                setSelectedManga(null)
                setSearchTerm('')
                setSearchQuery('')
              }}
              className="shrink-0 rounded p-1 text-ink-500 hover:text-ink-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Optional fields */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-ink-400">
              Language (optional)
            </label>
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="e.g. en, it"
              className="w-full rounded-lg border border-ink-800/50 bg-ink-900/50 px-3 py-2 text-sm text-ink-200 placeholder-ink-500 outline-none focus:border-accent-600/50"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-ink-400">
              Scanlator (optional)
            </label>
            <input
              type="text"
              value={scanlator}
              onChange={(e) => setScanlator(e.target.value)}
              placeholder="Group name"
              className="w-full rounded-lg border border-ink-800/50 bg-ink-900/50 px-3 py-2 text-sm text-ink-200 placeholder-ink-500 outline-none focus:border-accent-600/50"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!sourceId || !selectedManga}
            loading={loading}
          >
            Create Rule
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ── Utils ──

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
