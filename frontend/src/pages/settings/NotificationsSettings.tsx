import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  api,
  type KomfConfig,
  type DiscordTemplates,
  type AppriseTemplates,
  type DiscordRenderResult,
  type AppriseRenderResult,
  type EmbedFieldTemplate,
  type WebhookVerifyResponse,
  type NotificationLogEntry,
} from '@/api/client'
import { useAutoSave } from '@/hooks/useAutoSave'
import { PageHeader } from '@/components/PageHeader'
import { PageSpinner } from '@/components/Spinner'
import { ErrorState } from '@/components/ErrorState'
import {
  SettingsSection,
  ToggleField,
  SaveIndicator,
} from '@/components/settings/SettingsFields'
import { Button } from '@/components/Button'
import {
  Send,
  Plus,
  Trash2,
  Eye,
  ChevronDown,
  ChevronRight,
  Info,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { useState } from 'react'
import { clsx } from 'clsx'

// ── Velocity context variable reference ──────────────────────────

const VELOCITY_VARS = [
  { var: '$library.name', desc: 'Library name' },
  { var: '$series.name', desc: 'Series name' },
  { var: '$series.bookCount', desc: 'Number of books' },
  { var: '$series.metadata.status', desc: 'Status (ONGOING, ENDED…)' },
  { var: '$series.metadata.summary', desc: 'Summary text' },
  { var: '$series.metadata.publisher', desc: 'Publisher' },
  { var: '$series.metadata.genres', desc: 'Genres list' },
  { var: '$series.metadata.tags', desc: 'Tags list' },
  { var: '$series.metadata.authors', desc: 'Authors [{name, role}]' },
  { var: '$series.metadata.releaseYear', desc: 'Release year' },
  { var: '$series.metadata.links', desc: 'Links [{label, url}]' },
  { var: '$mediaServer', desc: 'Media server type (KOMGA)' },
  { var: '$books', desc: 'Book list (sorted by name)' },
]

// ── Page ─────────────────────────────────────────────────────────

export function NotificationsSettings() {
  const configQuery = useQuery({ queryKey: ['config'], queryFn: api.getConfig })

  if (configQuery.isLoading) return <PageSpinner />
  if (configQuery.isError)
    return (
      <ErrorState
        message="Failed to load config"
        onRetry={() => configQuery.refetch()}
      />
    )

  return <NotificationsForm config={configQuery.data!} />
}

// ── Form ─────────────────────────────────────────────────────────

function NotificationsForm({ config }: { config: KomfConfig }) {
  const { status, error, save, dismissError } = useAutoSave()

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Notifications"
        description="Configure Discord and Apprise notification integrations."
      />

      <div className="space-y-6">
        <DiscordSection config={config} status={status} error={error} save={save} dismissError={dismissError} />
        <AppriseSection config={config} status={status} error={error} save={save} dismissError={dismissError} />
        <NotificationDeliveryLogs />
        <IntegrationGuides />
        <VelocityReference />
      </div>
    </div>
  )
}

// ── Discord ──────────────────────────────────────────────────────

function DiscordSection({
  config,
  status,
  error,
  save,
  dismissError,
}: {
  config: KomfConfig
  status: 'idle' | 'saving' | 'saved' | 'error'
  error: string | null
  save: (patch: import('@/api/client').KomfConfigUpdateRequest, immediate?: boolean) => void
  dismissError: () => void
}) {
  const discord = config.notifications.discord
  const webhooks = discord.webhooks ?? []
  const locked = config.envLocks.discordWebhooks

  return (
    <SettingsSection
      title="Discord"
      description="Send rich embed notifications to Discord channels."
      action={<SaveIndicator status={status} error={error} onDismiss={dismissError} />}
    >
      <ToggleField
        label="Include Series Cover"
        checked={discord.seriesCover}
        description="Attach the series cover image to Discord notifications."
        onChange={(v) =>
          save({ notifications: { discord: { seriesCover: v } } }, true)
        }
      />

      <WebhookUrlList
        label="Webhooks"
        items={webhooks}
        placeholder="https://discord.com/api/webhooks/..."
        locked={locked}
        lockEnvName="KOMF_DISCORD_WEBHOOKS"
        onUpdate={(patch) =>
          save({ notifications: { discord: { webhooks: patch } } }, true)
        }
        verifyFn={(url) => api.verifyDiscordWebhook(url)}
      />

      <DiscordTemplateEditor />
    </SettingsSection>
  )
}

// ── Apprise ──────────────────────────────────────────────────────

function AppriseSection({
  config,
  save,
}: {
  config: KomfConfig
  status: 'idle' | 'saving' | 'saved' | 'error'
  error: string | null
  save: (patch: import('@/api/client').KomfConfigUpdateRequest, immediate?: boolean) => void
  dismissError: () => void
}) {
  const apprise = config.notifications.apprise
  const urls = apprise.urls ?? []
  const locked = config.envLocks.appriseUrls

  return (
    <SettingsSection
      title="Apprise"
      description="Send notifications via Apprise (supports 100+ services)."
    >
      <ToggleField
        label="Include Series Cover"
        checked={apprise.seriesCover}
        description="Attach the series cover image to Apprise notifications."
        onChange={(v) =>
          save({ notifications: { apprise: { seriesCover: v } } }, true)
        }
      />

      <WebhookUrlList
        label="URLs"
        items={urls}
        placeholder="e.g. tgram://bot_token/chat_id"
        locked={locked}
        lockEnvName="KOMF_APPRISE_URLS"
        onUpdate={(patch) =>
          save({ notifications: { apprise: { urls: patch } } }, true)
        }
      />

      <AppriseTemplateEditor />
    </SettingsSection>
  )
}

// ── Webhook / URL list manager ───────────────────────────────────

function WebhookUrlList({
  label,
  items,
  placeholder,
  locked,
  lockEnvName,
  onUpdate,
  verifyFn,
}: {
  label: string
  items: string[]
  placeholder: string
  locked?: boolean
  lockEnvName?: string
  onUpdate: (patch: Record<number, string | null>) => void
  verifyFn?: (url: string) => Promise<WebhookVerifyResponse>
}) {
  const [newValue, setNewValue] = useState('')
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [verifyStates, setVerifyStates] = useState<Record<number, { loading: boolean; result?: WebhookVerifyResponse }>>({})

  function handleAdd() {
    if (locked) return
    const trimmed = newValue.trim()
    if (!trimmed) return
    // Add at next index
    onUpdate({ [items.length]: trimmed })
    setNewValue('')
  }

  function handleRemove(index: number) {
    if (locked) return
    onUpdate({ [index]: null })
    if (editIndex === index) {
      setEditIndex(null)
      setEditValue('')
    }
  }

  function handleStartEdit(index: number) {
    if (locked) return
    setEditIndex(index)
    setEditValue(items[index] ?? '')
  }

  function handleSaveEdit(index: number) {
    if (locked) return
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== items[index]) {
      onUpdate({ [index]: trimmed })
    }
    setEditIndex(null)
    setEditValue('')
  }

  function handleCancelEdit() {
    setEditIndex(null)
    setEditValue('')
  }

  async function handleVerify(index: number) {
    if (!verifyFn || !items[index]) return
    setVerifyStates((prev) => ({ ...prev, [index]: { loading: true } }))
    try {
      const result = await verifyFn(items[index])
      setVerifyStates((prev) => ({ ...prev, [index]: { loading: false, result } }))
    } catch {
      setVerifyStates((prev) => ({
        ...prev,
        [index]: { loading: false, result: { valid: false, error: 'Request failed' } },
      }))
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-ink-300">
        {label}
        <span className="ml-2 text-xs text-ink-500">({items.length})</span>
      </label>

      {locked && lockEnvName && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Managed by environment variable: <span className="font-mono">{lockEnvName}</span>
        </p>
      )}

      {/* Existing items */}
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          {editIndex === i ? (
            <>
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit(i)
                  if (e.key === 'Escape') handleCancelEdit()
                }}
                autoFocus
                aria-label={`Edit ${label.toLowerCase()} URL`}
                className="flex-1 rounded-lg border border-accent-500/50 bg-ink-950/50 px-3 py-1.5 text-sm text-ink-100 focus:outline-none focus:ring-1 focus:ring-accent-500/30"
              />
              <Button variant="ghost" size="sm" onClick={() => handleSaveEdit(i)}>
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <code
                className="flex-1 cursor-pointer truncate rounded-lg bg-ink-950/30 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-800/40"
                title={item}
                onClick={() => handleStartEdit(i)}
              >
                {maskSecret(item)}
              </code>
              {verifyFn && (
                <button
                  onClick={() => handleVerify(i)}
                  disabled={verifyStates[i]?.loading}
                  className={clsx(
                    'shrink-0 rounded-md p-1 transition-colors',
                    verifyStates[i]?.result?.valid === true && 'text-emerald-400',
                    verifyStates[i]?.result?.valid === false && 'text-red-400',
                    !verifyStates[i]?.result && 'text-ink-500 hover:bg-accent-500/10 hover:text-accent-400',
                  )}
                  aria-label={`Verify ${label.toLowerCase()} ${i + 1}`}
                  title={verifyStates[i]?.result?.valid ? `✓ ${verifyStates[i]?.result?.name ?? 'Valid'}` : verifyStates[i]?.result?.error ?? 'Verify webhook'}
                >
                  {verifyStates[i]?.loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : verifyStates[i]?.result?.valid ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : verifyStates[i]?.result?.valid === false ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : (
                    <Shield className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              <button
                onClick={() => handleRemove(i)}
                disabled={locked}
                className="shrink-0 rounded-md p-1 text-ink-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ))}

      {/* Add new */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newValue}
          disabled={locked}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (locked) return
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder={placeholder}
          className={clsx(
            'flex-1 rounded-lg border border-dashed border-ink-700 bg-ink-950/30 px-3 py-1.5 text-sm text-ink-100 placeholder-ink-600 focus:border-accent-500 focus:outline-none',
            locked && 'cursor-not-allowed opacity-60',
          )}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAdd}
          disabled={locked || !newValue.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </div>
  )
}

function maskSecret(url: string): string {
  try {
    const u = new URL(url)
    // Discord webhooks: show only last 6 chars of token
    if (u.hostname === 'discord.com' || u.hostname === 'discordapp.com') {
      const parts = u.pathname.split('/')
      if (parts.length >= 4) {
        const token = parts[parts.length - 1]
        return `discord.com/.../${token?.slice(-6) ?? ''}`
      }
    }
    // For other URLs, show scheme + host + masked path
    if (u.pathname.length > 10) {
      return `${u.protocol}//${u.host}/...${u.pathname.slice(-8)}`
    }
    return url
  } catch {
    // Not a valid URL — show first/last chars
    if (url.length > 20) return `${url.slice(0, 8)}…${url.slice(-8)}`
    return url
  }
}

// ── Discord template editor ──────────────────────────────────────

function DiscordTemplateEditor() {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)

  const templatesQuery = useQuery({
    queryKey: ['discord-templates'],
    queryFn: api.getDiscordTemplates,
    enabled: expanded,
  })

  const saveMutation = useMutation({
    mutationFn: (templates: DiscordTemplates) =>
      api.updateDiscordTemplates(templates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discord-templates'] })
    },
  })

  const [preview, setPreview] = useState<DiscordRenderResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [testLoading, setTestLoading] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)

  // Local editable state
  const [local, setLocal] = useState<DiscordTemplates | null>(null)

  // Sync when server data loads — ensure fields is always an array
  const raw = local ?? templatesQuery.data
  const templates = raw ? { ...raw, fields: raw.fields ?? [] } : raw
  if (templatesQuery.data && !local) {
    setLocal({ ...templatesQuery.data, fields: templatesQuery.data.fields ?? [] })
  }

  function updateField<K extends keyof DiscordTemplates>(
    key: K,
    value: DiscordTemplates[K],
  ) {
    if (!local) return
    setLocal({ ...local, [key]: value })
  }

  function updateEmbedField(index: number, field: Partial<EmbedFieldTemplate>) {
    if (!local) return
    const fields = [...(local.fields ?? [])]
    fields[index] = { ...fields[index], ...field } as EmbedFieldTemplate
    setLocal({ ...local, fields })
  }

  function addEmbedField() {
    if (!local) return
    setLocal({
      ...local,
      fields: [
        ...(local.fields ?? []),
        { nameTemplate: '', valueTemplate: '', inline: false },
      ],
    })
  }

  function removeEmbedField(index: number) {
    if (!local) return
    setLocal({
      ...local,
      fields: (local.fields ?? []).filter((_, i) => i !== index),
    })
  }

  async function handlePreview() {
    if (!local) return
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const result = await api.renderDiscord({ templates: local })
      setPreview(result)
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Render failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleTest() {
    if (!local) return
    setTestLoading(true)
    setTestMessage(null)
    try {
      await api.sendDiscordTest({ templates: local })
      setTestMessage('Test notification sent')
      setTimeout(() => setTestMessage(null), 3000)
    } catch (e) {
      setTestMessage(
        `Failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
      )
      setTimeout(() => setTestMessage(null), 5000)
    } finally {
      setTestLoading(false)
    }
  }

  function handleSave() {
    if (!local) return
    saveMutation.mutate(local)
  }

  return (
    <div className="space-y-3">
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-lg bg-ink-950/30 px-4 py-2.5 text-left transition-colors hover:bg-ink-800/40"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-ink-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-ink-400" />
        )}
        <span className="text-sm font-medium text-ink-200">
          Template Editor
        </span>
        <span className="text-xs text-ink-500">Velocity templates for Discord embeds</span>
      </button>

      {expanded && templates && (
        <div className="space-y-4 rounded-lg border border-ink-800/40 bg-ink-950/20 p-4">
          <TemplateInput
            label="Title Template"
            value={templates.titleTemplate ?? ''}
            onChange={(v) => updateField('titleTemplate', v || null)}
            placeholder="e.g. $series.name"
          />
          <TemplateInput
            label="Title URL Template"
            value={templates.titleUrlTemplate ?? ''}
            onChange={(v) => updateField('titleUrlTemplate', v || null)}
            placeholder="e.g. https://..."
          />
          <TemplateTextarea
            label="Description Template"
            value={templates.descriptionTemplate ?? ''}
            onChange={(v) => updateField('descriptionTemplate', v || null)}
            placeholder="e.g. New metadata for $series.name in $library.name"
            rows={3}
          />
          <TemplateInput
            label="Footer Template"
            value={templates.footerTemplate ?? ''}
            onChange={(v) => updateField('footerTemplate', v || null)}
            placeholder="e.g. $mediaServer"
          />

          {/* Embed fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-ink-300">
                Embed Fields
                <span className="ml-2 text-xs text-ink-500">
                  ({templates.fields.length})
                </span>
              </label>
              <Button variant="ghost" size="sm" onClick={addEmbedField}>
                <Plus className="h-3.5 w-3.5" />
                Add Field
              </Button>
            </div>
            {templates.fields.map((field, i) => (
              <EmbedFieldEditor
                key={i}
                index={i}
                field={field}
                onChange={(f) => updateEmbedField(i, f)}
                onRemove={() => removeEmbedField(i)}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 border-t border-ink-800/40 pt-3">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={saveMutation.isPending}
            >
              Save Templates
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePreview}
              loading={previewLoading}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTest}
              loading={testLoading}
            >
              <Send className="h-3.5 w-3.5" />
              Send Test
            </Button>
            {saveMutation.isSuccess && (
              <span className="text-xs text-emerald-400">Saved</span>
            )}
            {saveMutation.isError && (
              <span className="text-xs text-red-400">
                {saveMutation.error.message}
              </span>
            )}
            {testMessage && (
              <span
                className={clsx(
                  'text-xs',
                  testMessage.startsWith('Failed')
                    ? 'text-red-400'
                    : 'text-emerald-400',
                )}
              >
                {testMessage}
              </span>
            )}
          </div>

          {/* Preview result */}
          {previewError && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {previewError}
            </div>
          )}
          {preview && <DiscordPreview result={preview} />}
        </div>
      )}

      {expanded && templatesQuery.isLoading && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-ink-400">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading templates…
        </div>
      )}
    </div>
  )
}

// ── Apprise template editor ──────────────────────────────────────

function AppriseTemplateEditor() {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)

  const templatesQuery = useQuery({
    queryKey: ['apprise-templates'],
    queryFn: api.getAppriseTemplates,
    enabled: expanded,
  })

  const saveMutation = useMutation({
    mutationFn: (templates: AppriseTemplates) =>
      api.updateAppriseTemplates(templates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apprise-templates'] })
    },
  })

  const [preview, setPreview] = useState<AppriseRenderResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [testLoading, setTestLoading] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)

  const [local, setLocal] = useState<AppriseTemplates | null>(null)

  const templates = local ?? templatesQuery.data
  if (templatesQuery.data && !local) {
    setLocal(templatesQuery.data)
  }

  async function handlePreview() {
    if (!local) return
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const result = await api.renderApprise({ templates: local })
      setPreview(result)
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Render failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleTest() {
    if (!local) return
    setTestLoading(true)
    setTestMessage(null)
    try {
      await api.sendAppriseTest({ templates: local })
      setTestMessage('Test notification sent')
      setTimeout(() => setTestMessage(null), 3000)
    } catch (e) {
      setTestMessage(
        `Failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
      )
      setTimeout(() => setTestMessage(null), 5000)
    } finally {
      setTestLoading(false)
    }
  }

  function handleSave() {
    if (!local) return
    saveMutation.mutate(local)
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-lg bg-ink-950/30 px-4 py-2.5 text-left transition-colors hover:bg-ink-800/40"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-ink-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-ink-400" />
        )}
        <span className="text-sm font-medium text-ink-200">
          Template Editor
        </span>
        <span className="text-xs text-ink-500">Velocity templates for Apprise</span>
      </button>

      {expanded && templates && (
        <div className="space-y-4 rounded-lg border border-ink-800/40 bg-ink-950/20 p-4">
          <TemplateInput
            label="Title Template"
            value={templates.titleTemplate ?? ''}
            onChange={(v) => setLocal({ ...templates, titleTemplate: v || null })}
            placeholder="e.g. $series.name - New Metadata"
          />
          <TemplateTextarea
            label="Body Template"
            value={templates.bodyTemplate ?? ''}
            onChange={(v) => setLocal({ ...templates, bodyTemplate: v || null })}
            placeholder="e.g. Metadata updated for $series.name ($series.bookCount books)"
            rows={5}
          />

          <div className="flex items-center gap-2 border-t border-ink-800/40 pt-3">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={saveMutation.isPending}
            >
              Save Templates
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePreview}
              loading={previewLoading}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTest}
              loading={testLoading}
            >
              <Send className="h-3.5 w-3.5" />
              Send Test
            </Button>
            {saveMutation.isSuccess && (
              <span className="text-xs text-emerald-400">Saved</span>
            )}
            {saveMutation.isError && (
              <span className="text-xs text-red-400">
                {saveMutation.error.message}
              </span>
            )}
            {testMessage && (
              <span
                className={clsx(
                  'text-xs',
                  testMessage.startsWith('Failed')
                    ? 'text-red-400'
                    : 'text-emerald-400',
                )}
              >
                {testMessage}
              </span>
            )}
          </div>

          {previewError && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {previewError}
            </div>
          )}
          {preview && (
            <div className="rounded-lg border border-ink-800/40 bg-ink-900/50 p-4 space-y-2">
              <h5 className="text-xs font-semibold uppercase text-ink-500">Preview</h5>
              {preview.title && (
                <p className="text-sm font-medium text-ink-100">{preview.title}</p>
              )}
              <p className="whitespace-pre-wrap text-sm text-ink-300">
                {preview.body}
              </p>
            </div>
          )}
        </div>
      )}

      {expanded && templatesQuery.isLoading && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-ink-400">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading templates…
        </div>
      )}
    </div>
  )
}

// ── Template input helpers ───────────────────────────────────────

function TemplateInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-ink-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-ink-700 bg-ink-950/50 px-3 py-1.5 font-mono text-xs text-ink-100 placeholder-ink-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30"
      />
    </div>
  )
}

function TemplateTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-ink-400">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-lg border border-ink-700 bg-ink-950/50 px-3 py-1.5 font-mono text-xs text-ink-100 placeholder-ink-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30"
      />
    </div>
  )
}

// ── Discord embed field editor ───────────────────────────────────

function EmbedFieldEditor({
  index,
  field,
  onChange,
  onRemove,
}: {
  index: number
  field: EmbedFieldTemplate
  onChange: (f: Partial<EmbedFieldTemplate>) => void
  onRemove: () => void
}) {
  return (
    <div className="flex gap-2 rounded-lg border border-ink-800/30 bg-ink-900/30 p-3">
      <div className="flex-1 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <TemplateInput
            label={`Field ${index + 1} Name`}
            value={field.nameTemplate}
            onChange={(v) => onChange({ nameTemplate: v })}
            placeholder="e.g. Status"
          />
          <TemplateInput
            label={`Field ${index + 1} Value`}
            value={field.valueTemplate}
            onChange={(v) => onChange({ valueTemplate: v })}
            placeholder="e.g. $series.metadata.status"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-400">
          <input
            type="checkbox"
            checked={field.inline}
            onChange={(e) => onChange({ inline: e.target.checked })}
            className="rounded border-ink-600"
          />
          Inline
        </label>
      </div>
      <button
        onClick={onRemove}
        className="self-start rounded-md p-1 text-ink-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
        aria-label={`Remove field ${index + 1}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Discord preview ──────────────────────────────────────────────

function DiscordPreview({ result }: { result: DiscordRenderResult }) {
  return (
    <div className="rounded-lg border-l-4 border-l-[#1F8B4C] bg-[#2f3136] p-4 space-y-2">
      <h5 className="text-xs font-semibold uppercase text-ink-500 mb-2">
        Discord Embed Preview
      </h5>
      {result.title && (
        <p className="text-sm font-semibold text-[#00b0f4]">
          {result.titleUrl ? (
            <span className="cursor-default">{result.title}</span>
          ) : (
            result.title
          )}
        </p>
      )}
      {result.description && (
        <p className="whitespace-pre-wrap text-sm text-[#dcddde]">
          {result.description}
        </p>
      )}
      {result.fields.length > 0 && (
        <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
          {result.fields.map((f, i) => (
            <div
              key={i}
              className={f.inline ? '' : 'col-span-full'}
            >
              <p className="text-xs font-semibold text-[#b9bbbe]">{f.name}</p>
              <p className="text-sm text-[#dcddde]">{f.value}</p>
            </div>
          ))}
        </div>
      )}
      {result.footer && (
        <p className="border-t border-[#40444b] pt-2 text-xs text-[#72767d]">
          {result.footer}
        </p>
      )}
    </div>
  )
}

// ── Notification Delivery Logs ───────────────────────────────────

function NotificationDeliveryLogs() {
  const [expanded, setExpanded] = useState(false)
  const logsQuery = useQuery({
    queryKey: ['notificationLogs'],
    queryFn: () => api.getNotificationLogs(20),
    enabled: expanded,
    refetchInterval: expanded ? 15000 : false,
  })

  return (
    <div className="rounded-2xl border border-ink-800/50 bg-ink-900/50 p-5 space-y-3">
      <button
        className="flex items-center gap-2 text-sm font-medium text-ink-200 hover:text-ink-50 transition-colors w-full"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Delivery Logs
        {logsQuery.data && (
          <span className="text-xs text-ink-400 ml-auto">{logsQuery.data.totalCount} total</span>
        )}
      </button>

      {expanded && (
        <div className="space-y-2">
          {logsQuery.isLoading && (
            <p className="text-xs text-ink-400">Loading...</p>
          )}
          {logsQuery.data && logsQuery.data.logs.length === 0 && (
            <p className="text-xs text-ink-400">No delivery logs yet.</p>
          )}
          {logsQuery.data && logsQuery.data.logs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-ink-400 border-b border-ink-800/50">
                    <th className="text-left py-1 pr-3">Time</th>
                    <th className="text-left py-1 pr-3">Channel</th>
                    <th className="text-left py-1 pr-3">Status</th>
                    <th className="text-left py-1">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {logsQuery.data.logs.map((log: NotificationLogEntry) => (
                    <tr key={log.id} className="border-b border-ink-800/30">
                      <td className="py-1.5 pr-3 text-ink-300 whitespace-nowrap">
                        {new Date(log.sentAt).toLocaleString()}
                      </td>
                      <td className="py-1.5 pr-3 text-ink-200 capitalize">{log.channel}</td>
                      <td className="py-1.5 pr-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-1.5 text-ink-400 max-w-[200px] truncate">
                        {log.errorMessage || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Integration guides ───────────────────────────────────────────

function IntegrationGuides() {
  const [showTelegram, setShowTelegram] = useState(false)
  const [showPushover, setShowPushover] = useState(false)

  return (
    <div className="rounded-2xl border border-ink-800/50 bg-ink-900/50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-accent-400" />
        <h3 className="text-sm font-semibold text-ink-200">Apprise Integrations</h3>
      </div>
      <p className="text-xs text-ink-400">
        Apprise supports 100+ notification services. Add the correct URL in the Apprise URLs section above.
        Here are guides for the most common ones:
      </p>

      {/* Telegram */}
      <div className="rounded-lg border border-ink-700/50 bg-ink-950/30">
        <button
          onClick={() => setShowTelegram(!showTelegram)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-sm font-medium text-ink-200">📨 Telegram</span>
          {showTelegram ? <ChevronDown className="h-4 w-4 text-ink-500" /> : <ChevronRight className="h-4 w-4 text-ink-500" />}
        </button>
        {showTelegram && (
          <div className="border-t border-ink-700/50 px-4 py-3 space-y-2 text-xs text-ink-400">
            <p><strong className="text-ink-200">1.</strong> Open Telegram and search for <code className="text-accent-400">@BotFather</code></p>
            <p><strong className="text-ink-200">2.</strong> Send <code className="text-accent-400">/newbot</code> and follow the instructions</p>
            <p><strong className="text-ink-200">3.</strong> Copy the <strong className="text-ink-200">Bot Token</strong> (e.g. <code className="text-ink-300">123456:ABC-DEF...</code>)</p>
            <p><strong className="text-ink-200">4.</strong> Add the bot to your desired group or channel</p>
            <p><strong className="text-ink-200">5.</strong> Get the <strong className="text-ink-200">Chat ID</strong>: send a message to the bot, then open<br />
              <code className="text-ink-300 break-all">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code>
            </p>
            <div className="mt-3 rounded-lg bg-ink-900 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 mb-1">Apprise URL Format</p>
              <code className="text-accent-400 text-xs">tgram://BOT_TOKEN/CHAT_ID</code>
            </div>
            <p className="text-ink-500">Example: <code className="text-ink-300">tgram://123456:ABC-DEF/-100123456789</code></p>
          </div>
        )}
      </div>

      {/* Pushover */}
      <div className="rounded-lg border border-ink-700/50 bg-ink-950/30">
        <button
          onClick={() => setShowPushover(!showPushover)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-sm font-medium text-ink-200">🔔 Pushover</span>
          {showPushover ? <ChevronDown className="h-4 w-4 text-ink-500" /> : <ChevronRight className="h-4 w-4 text-ink-500" />}
        </button>
        {showPushover && (
          <div className="border-t border-ink-700/50 px-4 py-3 space-y-2 text-xs text-ink-400">
            <p><strong className="text-ink-200">1.</strong> Sign up at <a href="https://pushover.net" target="_blank" rel="noopener noreferrer" className="text-accent-400 hover:text-accent-300">pushover.net</a></p>
            <p><strong className="text-ink-200">2.</strong> Copy your <strong className="text-ink-200">User Key</strong> from the dashboard</p>
            <p><strong className="text-ink-200">3.</strong> Create a new application to obtain your <strong className="text-ink-200">API Token</strong></p>
            <div className="mt-3 rounded-lg bg-ink-900 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 mb-1">Apprise URL Format</p>
              <code className="text-accent-400 text-xs">pover://USER_KEY@API_TOKEN</code>
            </div>
            <p className="text-ink-500">Example: <code className="text-ink-300">pover://abc123@def456</code></p>
          </div>
        )}
      </div>

      <p className="text-xs text-ink-500">
        See the{' '}
        <a href="https://github.com/caronc/apprise/wiki" target="_blank" rel="noopener noreferrer" className="text-accent-400 hover:text-accent-300">
          Apprise documentation
        </a>{' '}
        for all supported services (Slack, Gotify, ntfy, Matrix, email, etc.).
      </p>
    </div>
  )
}

// ── Velocity variable reference ──────────────────────────────────

function VelocityReference() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl border border-ink-800/50 bg-ink-900/50 p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left"
      >
        <Info className="h-4 w-4 text-ink-400" />
        <span className="text-sm font-medium text-ink-200">
          Template Variables Reference
        </span>
        {expanded ? (
          <ChevronDown className="ml-auto h-4 w-4 text-ink-500" />
        ) : (
          <ChevronRight className="ml-auto h-4 w-4 text-ink-500" />
        )}
      </button>
      {expanded && (
        <div className="mt-3 space-y-1">
          <p className="mb-2 text-xs text-ink-500">
            Templates use Apache Velocity syntax. Use <code className="text-accent-400">$variable</code> to
            insert values.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
            {VELOCITY_VARS.map((v) => (
              <div key={v.var} className="flex items-baseline gap-2 py-0.5">
                <code className="shrink-0 text-xs text-accent-400">{v.var}</code>
                <span className="text-xs text-ink-500">{v.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
