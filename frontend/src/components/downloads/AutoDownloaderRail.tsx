import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Check, Edit3, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { api } from '@/api/client'
import type {
  AutoDownloaderRuleDto,
  CreateAutoDownloaderRuleDto,
  MangaSearchResultDto,
  MangaSourceId,
  UpdateAutoDownloaderRuleDto,
} from '@/api/sources'
import { Eyebrow, HairRule } from '@/components/atelier'
import { useConfirm, ConfirmDialog } from '@/components/ConfirmDialog'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'

export interface AutoDownloaderRailProps {
  variant?: 'rail' | 'block'
  className?: string
}

export function AutoDownloaderRail({
  variant = 'rail',
  className,
}: AutoDownloaderRailProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { confirm, dialogProps } = useConfirm()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const statusQuery = useQuery({
    queryKey: ['auto-downloader-status'],
    queryFn: api.getAutoDownloaderStatus,
    refetchInterval: 30_000,
  })

  const rulesQuery = useQuery({
    queryKey: ['auto-downloader-rules'],
    queryFn: api.getAutoDownloaderRules,
  })

  const checkNowMutation = useMutation({
    mutationFn: api.autoDownloaderCheckNow,
    onSuccess: () => {
      toast('Controllo avviato', 'success')
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-status'] })
    },
    onError: (err: Error) => toast(err.message || 'Controllo fallito', 'error'),
  })

  const createMutation = useMutation({
    mutationFn: api.createAutoDownloaderRule,
    onSuccess: () => {
      toast('Regola creata', 'success')
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-rules'] })
      setShowCreate(false)
    },
    onError: (err: Error) => toast(err.message || 'Creazione fallita', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAutoDownloaderRuleDto }) =>
      api.updateAutoDownloaderRule(id, body),
    onSuccess: () => {
      toast('Regola aggiornata', 'success')
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-rules'] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteAutoDownloaderRule,
    onSuccess: () => {
      toast('Regola eliminata', 'success')
      queryClient.invalidateQueries({ queryKey: ['auto-downloader-rules'] })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.updateAutoDownloaderRule(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auto-downloader-rules'] }),
  })

  const status = statusQuery.data
  const rules = rulesQuery.data ?? []

  const containerClass = clsx(
    variant === 'rail'
      ? 'lg:sticky lg:top-8 lg:self-start lg:w-[280px]'
      : 'w-full',
    className,
  )

  return (
    <aside className={containerClass} aria-label="Automazione download">
      <ConfirmDialog {...dialogProps} />

      <Eyebrow jp="自動" en="Automazione" />
      <h2 className="mt-3 font-serif italic text-[26px] leading-none tracking-[-0.01em] ma-text">
        {status?.enabled ? 'In ascolto' : 'In pausa'}
      </h2>

      <div className="mt-5 flex items-center gap-2 font-opsMono text-[10px] uppercase tracking-[0.2em]">
        <span
          className={clsx(
            'inline-block h-1.5 w-1.5 rounded-full',
            status?.enabled ? 'ma-bg-ok' : 'ma-bg-warn',
          )}
          aria-hidden
        />
        <span className={status?.enabled ? 'ma-ok' : 'ma-warn'}>
          {status?.enabled ? 'attivo' : 'disattivato'}
        </span>
        <span className="ma-faint">·</span>
        <span className="ma-muted">
          {status?.activeRulesCount ?? 0} regol{(status?.activeRulesCount ?? 0) === 1 ? 'a' : 'e'}
        </span>
      </div>

      <dl className="mt-4 space-y-1 font-opsMono text-[10px] uppercase tracking-[0.18em]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="ma-faint">Ultimo</dt>
          <dd className="ma-muted truncate">
            {status?.lastCheck ? formatRelative(status.lastCheck) : '—'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="ma-faint">Prossimo</dt>
          <dd className="ma-muted truncate">
            {status?.nextCheck ? formatRelative(status.nextCheck) : '—'}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => checkNowMutation.mutate()}
        disabled={checkNowMutation.isPending || !status?.enabled}
        className="mt-4 inline-flex items-center gap-2 font-opsMono text-[11px] uppercase tracking-[0.2em] ma-muted transition-colors hover:ma-text disabled:opacity-40"
      >
        <RefreshCw className={clsx('h-3 w-3', checkNowMutation.isPending && 'animate-spin')} />
        Controlla ora
      </button>

      <div className="mt-6">
        <HairRule label={`Regole (${rules.length})`} />
      </div>

      {rulesQuery.isLoading && (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {rulesQuery.isError && (
        <p className="mt-3 font-sans text-xs ma-warn">Errore caricamento regole</p>
      )}

      {rulesQuery.isSuccess && rules.length === 0 && !showCreate && (
        <p className="mt-3 font-sans text-[13px] leading-snug ma-muted">
          Nessuna regola. Aggiungine una per scaricare automaticamente i nuovi capitoli.
        </p>
      )}

      {rules.length > 0 && (
        <ul className="mt-2">
          {rules.map((rule) => (
            <RuleItem
              key={rule.id}
              rule={rule}
              isEditing={editingId === rule.id}
              onEditToggle={() => setEditingId(editingId === rule.id ? null : rule.id)}
              onToggle={(enabled) => toggleMutation.mutate({ id: rule.id, enabled })}
              onDelete={() =>
                confirm(`Eliminare la regola per "${rule.mangaTitle}"?`, () =>
                  deleteMutation.mutate(rule.id),
                )
              }
              onUpdate={(body) => updateMutation.mutate({ id: rule.id, body })}
            />
          ))}
        </ul>
      )}

      <div className="mt-4">
        {!showCreate ? (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 font-opsMono text-[11px] uppercase tracking-[0.2em] ma-accent transition-opacity hover:opacity-80"
          >
            <Plus className="h-3 w-3" />
            Aggiungi regola
          </button>
        ) : (
          <AddRuleForm
            onCancel={() => setShowCreate(false)}
            onSubmit={(dto) => createMutation.mutate(dto)}
            loading={createMutation.isPending}
          />
        )}
      </div>
    </aside>
  )
}

// ── Rule item ──

function RuleItem({
  rule,
  isEditing,
  onEditToggle,
  onToggle,
  onDelete,
  onUpdate,
}: {
  rule: AutoDownloaderRuleDto
  isEditing: boolean
  onEditToggle: () => void
  onToggle: (enabled: boolean) => void
  onDelete: () => void
  onUpdate: (body: UpdateAutoDownloaderRuleDto) => void
}) {
  const [editLang, setEditLang] = useState(rule.language ?? '')
  const [editScanlator, setEditScanlator] = useState(rule.scanlator ?? '')
  const [editLastChapter, setEditLastChapter] = useState(
    rule.lastChapterNumber?.toString() ?? '',
  )

  return (
    <li className="border-b ma-hair py-2.5 last:border-b-0">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onToggle(!rule.enabled)}
          className={clsx(
            'mt-1.5 shrink-0',
            'relative inline-flex h-3 w-6 items-center rounded-full border transition-colors',
            rule.enabled
              ? 'ma-hair-strong border bg-[var(--ma-accent-soft)]'
              : 'ma-hair',
          )}
          aria-label={rule.enabled ? 'Disattiva regola' : 'Attiva regola'}
          title={rule.enabled ? 'Disattiva' : 'Attiva'}
        >
          <span
            className={clsx(
              'inline-block h-2 w-2 rounded-full transition-transform',
              rule.enabled
                ? 'translate-x-3 ma-bg-accent'
                : 'translate-x-0.5 bg-[var(--ma-fg-faint)]',
            )}
            aria-hidden
          />
        </button>

        <div className={clsx('min-w-0 flex-1', !rule.enabled && 'opacity-60')}>
          <p className="truncate font-serif italic text-[14px] leading-tight ma-text">
            {rule.mangaTitle}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-opsMono text-[10px] uppercase tracking-[0.14em] ma-faint">
            <span>{rule.sourceId.toLowerCase()}</span>
            {rule.language && <span>· {rule.language}</span>}
            {rule.lastChapterNumber != null && <span>· ch.{rule.lastChapterNumber}</span>}
          </div>
        </div>

        <div className="flex shrink-0 gap-0.5">
          <button
            type="button"
            onClick={onEditToggle}
            aria-label="Modifica regola"
            title="Modifica"
            className="flex h-7 w-7 items-center justify-center rounded-sm ma-muted transition-colors hover:ma-text hover:bg-[var(--ma-surface)]"
          >
            <Edit3 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Elimina regola"
            title="Elimina"
            className="flex h-7 w-7 items-center justify-center rounded-sm ma-muted transition-colors hover:ma-warn hover:bg-[var(--ma-surface)]"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="mt-2 ml-8 space-y-2">
          <InlineField label="Lingua" value={editLang} onChange={setEditLang} placeholder="en" />
          <InlineField
            label="Scanlator"
            value={editScanlator}
            onChange={setEditScanlator}
            placeholder="gruppo"
          />
          <InlineField
            label="Ultimo ch."
            value={editLastChapter}
            onChange={setEditLastChapter}
            placeholder="0"
            type="number"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onEditToggle}
              className="font-opsMono text-[10px] uppercase tracking-[0.2em] ma-muted hover:ma-text"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdate({
                  language: editLang || null,
                  scanlator: editScanlator || null,
                  lastChapterNumber: editLastChapter ? parseFloat(editLastChapter) : null,
                })
              }
              className="inline-flex items-center gap-1 font-opsMono text-[10px] uppercase tracking-[0.2em] ma-accent hover:opacity-80"
            >
              <Check className="h-3 w-3" /> Salva
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function InlineField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'number'
}) {
  return (
    <label className="block">
      <span className="block font-opsMono text-[10px] uppercase tracking-[0.18em] ma-faint">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={type === 'number' ? '0.1' : undefined}
        className="mt-0.5 w-full border-b ma-hair bg-transparent pb-1 font-sans text-[12px] ma-text outline-none transition-colors focus:border-[var(--ma-hair-strong)]"
      />
    </label>
  )
}

// ── Add rule form ──

function AddRuleForm({
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
  const [selected, setSelected] = useState<MangaSearchResultDto | null>(null)
  const [language, setLanguage] = useState('')
  const [scanlator, setScanlator] = useState('')

  const sourcesQuery = useQuery({
    queryKey: ['manga-sources'],
    queryFn: api.getSources,
  })

  const searchResults = useQuery({
    queryKey: ['auto-dl-search', sourceId, searchTerm],
    queryFn: () => api.searchSource(sourceId as string, searchTerm, 8),
    enabled: !!sourceId && searchTerm.length >= 2,
  })

  const canSubmit = !!sourceId && !!selected

  return (
    <div className="border-t ma-hair pt-4" role="group" aria-label="Aggiungi regola">
      <div className="flex items-center justify-between">
        <Eyebrow en="Nuova regola" />
        <button
          type="button"
          onClick={onCancel}
          aria-label="Chiudi"
          className="ma-faint hover:ma-text"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="block font-opsMono text-[10px] uppercase tracking-[0.18em] ma-faint">
            Sorgente
          </span>
          <select
            aria-label="Sorgente"
            value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value as MangaSourceId)
              setSelected(null)
              setSearchTerm('')
              setSearchQuery('')
            }}
            className="mt-0.5 w-full border-b ma-hair bg-transparent pb-1 font-sans text-[12px] ma-text outline-none transition-colors focus:border-[var(--ma-hair-strong)]"
          >
            <option value="">Seleziona…</option>
            {(sourcesQuery.data ?? []).map((s) => (
              <option key={s.sourceId} value={s.sourceId}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {sourceId && !selected && (
          <div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (searchQuery.trim().length >= 2) setSearchTerm(searchQuery.trim())
              }}
              className="flex items-end gap-2"
            >
              <label className="flex-1 block">
                <span className="block font-opsMono text-[10px] uppercase tracking-[0.18em] ma-faint">
                  Manga
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="cerca…"
                  className="mt-0.5 w-full border-b ma-hair bg-transparent pb-1 font-sans text-[12px] ma-text outline-none transition-colors focus:border-[var(--ma-hair-strong)]"
                />
              </label>
              <button
                type="submit"
                disabled={searchQuery.trim().length < 2}
                aria-label="Cerca"
                className="pb-1 ma-muted transition-colors hover:ma-text disabled:opacity-30"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            </form>

            {searchResults.isFetching && (
              <p className="mt-2 font-opsMono text-[10px] uppercase tracking-[0.18em] ma-faint">
                ricerca in corso…
              </p>
            )}

            {searchResults.data && searchResults.data.length > 0 && (
              <ul className="mt-2 max-h-48 overflow-y-auto">
                {searchResults.data.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(r)}
                      className="flex w-full items-center gap-2 py-1.5 text-left transition-colors hover:bg-[var(--ma-surface)]"
                    >
                      {r.coverUrl && (
                        <img
                          src={r.coverUrl}
                          alt=""
                          className="h-8 w-6 shrink-0 object-cover"
                        />
                      )}
                      <span className="truncate font-sans text-[12px] ma-text">{r.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {selected && (
          <div className="flex items-center gap-2 border-l-2 border-[var(--ma-accent)] pl-2">
            {selected.coverUrl && (
              <img src={selected.coverUrl} alt="" className="h-8 w-6 shrink-0 object-cover" />
            )}
            <span className="min-w-0 flex-1 truncate font-serif italic text-[13px] ma-text">
              {selected.title}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelected(null)
                setSearchTerm('')
                setSearchQuery('')
              }}
              aria-label="Deseleziona"
              className="ma-faint hover:ma-text"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <InlineField label="Lingua" value={language} onChange={setLanguage} placeholder="en" />
          <InlineField
            label="Scanlator"
            value={scanlator}
            onChange={setScanlator}
            placeholder="opt."
          />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="font-opsMono text-[10px] uppercase tracking-[0.2em] ma-muted hover:ma-text"
          >
            Annulla
          </button>
          <button
            type="button"
            disabled={!canSubmit || loading}
            onClick={() => {
              if (!canSubmit || !selected || !sourceId) return
              onSubmit({
                sourceId: sourceId as MangaSourceId,
                mangaId: selected.id,
                mangaTitle: selected.title,
                language: language || undefined,
                scanlator: scanlator || undefined,
              })
            }}
            className="inline-flex items-center gap-1 font-opsMono text-[10px] uppercase tracking-[0.2em] ma-accent hover:opacity-80 disabled:opacity-30"
          >
            <Check className="h-3 w-3" /> {loading ? 'salvataggio…' : 'Crea'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── utils ──

function formatRelative(iso: string): string {
  try {
    const date = new Date(iso)
    const now = Date.now()
    const diffSec = Math.round((date.getTime() - now) / 1000)
    const absSec = Math.abs(diffSec)
    const future = diffSec > 0
    if (absSec < 60) return future ? 'tra poco' : 'ora'
    if (absSec < 3600) {
      const m = Math.round(absSec / 60)
      return future ? `tra ${m}m` : `${m}m fa`
    }
    if (absSec < 86_400) {
      const h = Math.round(absSec / 3600)
      return future ? `tra ${h}h` : `${h}h fa`
    }
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

