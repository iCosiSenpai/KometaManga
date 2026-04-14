import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api, type KomfConfig } from '@/api/client'
import { useAutoSave } from '@/hooks/useAutoSave'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardHeader } from '@/components/Card'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/Button'
import { PageSpinner } from '@/components/Spinner'
import { ErrorState } from '@/components/ErrorState'
import {
  SettingsSection,
  TextField,
  SaveIndicator,
} from '@/components/settings/SettingsFields'
import {
  Tv2,
  Settings2,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Maximize2,
  Minimize2,
  Plug,
  CheckCircle2,
  XCircle,
  Sparkles,
  Globe,
  Code2,
  Link2,
  Search,
  Play,
  RotateCcw,
  Shield,
} from 'lucide-react'
import { clsx } from 'clsx'

type KomgaTab = 'browse' | 'setup' | 'connection'

const TABS: { id: KomgaTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'browse', label: 'Browse', icon: Tv2 },
  { id: 'setup', label: 'Setup', icon: Settings2 },
  
  { id: 'connection', label: 'Connection', icon: Plug },
]

export function KomgaPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as KomgaTab) || 'browse'
  const initialPath = searchParams.get('path') || null
  const [activeTab, setActiveTab] = useState<KomgaTab>(initialTab)

  function switchTab(tab: KomgaTab) {
    setActiveTab(tab)
    setSearchParams(tab === 'browse' ? {} : { tab })
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Komga"
        description="Browse your Komga library, set up injection, and monitor connection status."
      />

      {/* Tab bar */}
      <div className="mb-6 flex items-center gap-1 rounded-xl border border-ink-800/50 bg-ink-900/30 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === id
                ? 'bg-ink-800 text-ink-100'
                : 'text-ink-400 hover:bg-ink-800/50 hover:text-ink-200',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'browse' && <BrowseTab initialPath={initialPath} />}
      {activeTab === 'setup' && <SetupTab />}
       
      {activeTab === 'connection' && <ConnectionTab />}
    </div>
  )
}

// â”€â”€ Browse Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BrowseTab({ initialPath }: { initialPath?: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const iframeSrc = initialPath ? `/komga-proxy${initialPath}` : '/komga-proxy/'

  const statusQuery = useQuery({
    queryKey: ['komga-integration-status'],
    queryFn: api.getKomgaIntegrationStatus,
  })

  if (statusQuery.isLoading) return <PageSpinner />

  if (statusQuery.isError || !statusQuery.data?.connected) {
    return (
      <ErrorState
        message="Unable to connect to Komga"
        hint={statusQuery.data?.errorMessage || 'Check your connection settings.'}
        onRetry={() => statusQuery.refetch()}
      />
    )
  }

  if (!statusQuery.data?.baseUri) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-amber-900/30 bg-amber-950/10 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
          <AlertTriangle className="h-6 w-6 text-amber-400" />
        </div>
        <div className="max-w-xs">
          <p className="font-display font-semibold text-ink-200">No Komga URI Configured</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
            Configure your Komga connection in the <strong className="text-ink-300">Settings</strong> tab above.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('transition-all duration-300', expanded ? 'fixed inset-0 z-50 bg-ink-950' : 'relative')}>
      {/* Toolbar */}
      <div className={clsx(
        'flex items-center justify-between border-b border-ink-800/50 bg-ink-950/90 px-3 backdrop-blur-sm',
        expanded ? 'h-10' : 'mb-0 h-10 rounded-t-2xl border-x border-t',
      )}>
        <span className="text-xs text-ink-500">Komga — Embedded Browser</span>
        <div className="flex items-center gap-2">
          <a
            href="/komga-proxy/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-400 transition-colors hover:bg-ink-800/50 hover:text-ink-200"
          >
            <ExternalLink className="h-3 w-3" />
            New Tab
          </a>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-400 transition-colors hover:bg-ink-800/50 hover:text-ink-200"
          >
            {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            {expanded ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>
      <iframe
        src={iframeSrc}
        title="Komga"
        className={clsx(
          'w-full border-none',
          expanded ? 'h-[calc(100%-2.5rem)]' : 'h-[calc(100vh-16rem)] rounded-b-2xl border-x border-b border-ink-800/50',
        )}
      />
    </div>
  )
}

// â”€â”€ Setup Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SetupTab() {
  const scriptUrl = `${window.location.origin}/komga-inject.js`
  const userscript = `// ==UserScript==
// @name         KometaManga â†’ Komga
// @namespace    kometamanga
// @version      1.0
// @description  Adds Identify/Match/Reset buttons to Komga WebUI
// @match        ${window.location.protocol}//${window.location.hostname}:*/*
// @grant        none
// ==/UserScript==

window.KOMETA_BASE = '${window.location.origin}';
const s = document.createElement('script');
s.src = '${scriptUrl}';
document.head.appendChild(s);`

  return (
    <div className="space-y-6">
      {/* Feature overview */}
      <Card>
        <CardHeader title="What Gets Injected" />
        <p className="mb-4 text-sm text-ink-400">
          The injection script adds a <strong className="text-ink-200">KometaManga toolbar</strong>{' '}
          directly into Komga's UI, giving you metadata controls without leaving your library.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureChip icon={<Search className="h-4 w-4" />} title="Identify" desc="Search providers and pick the correct series" />
          <FeatureChip icon={<Play className="h-4 w-4" />} title="Match" desc="Auto-match metadata for one or all series" />
          <FeatureChip icon={<RotateCcw className="h-4 w-4" />} title="Reset" desc="Clear metadata and optionally ComicInfo" />
          <FeatureChip icon={<Shield className="h-4 w-4" />} title="Safe Fallback" desc="If Komga UI changes, toolbar simply won't appear" />
        </div>
        <div className="mt-4 space-y-1 text-xs text-ink-500">
          <p>â€¢ <strong className="text-ink-400">Series pages:</strong> Identify (search + select), Match, Reset</p>
          <p>â€¢ <strong className="text-ink-400">Library pages:</strong> Match All, Reset Library, Reset + ComicInfo</p>
        </div>
      </Card>

      {/* Installation methods */}
      <div>
        <h3 className="mb-4 font-display text-base font-semibold text-ink-200">Installation Methods</h3>
        <div className="space-y-4">
          {/* Method 1 */}
          <Card variant="accent">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-600/20">
                <Sparkles className="h-5 w-5 text-accent-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-display text-sm font-semibold text-ink-100">
                    Method 1: Automatic In-App
                  </h4>
                  <span className="rounded-full bg-accent-600/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-400">
                    Recommended
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-ink-400">
                  Open the <strong className="text-ink-200">Browse</strong> tab above     Komga loads inside KometaManga
                  with metadata tools injected automatically via the built-in reverse proxy. No extra setup needed.
                </p>
              </div>
            </div>
          </Card>

          {/* Method 2 */}
          <Card>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-800">
                <Code2 className="h-5 w-5 text-ink-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-display text-sm font-semibold text-ink-100">
                  Method 2: Userscript
                </h4>
                <p className="mt-1.5 mb-3 text-sm text-ink-400">
                  If you prefer accessing Komga directly in your browser (not via the Browse tab), install{' '}
                  <a href="https://www.tampermonkey.net/" target="_blank" rel="noopener noreferrer" className="text-accent-400 hover:text-accent-300">
                    Tampermonkey <ExternalLink className="inline h-3 w-3" />
                  </a>{' '}
                  then create a new script with this content:
                </p>
                <CodeBlock code={userscript} />
              </div>
            </div>
          </Card>

          {/* Method 3 */}
          <Card>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-800">
                <Globe className="h-5 w-5 text-ink-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-display text-sm font-semibold text-ink-100">
                    Method 3: Reverse Proxy
                  </h4>
                  <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                    Advanced
                  </span>
                </div>
                <p className="mt-1.5 mb-3 text-sm text-ink-400">
                  Only needed if you already use Nginx/Caddy to serve Komga and want the toolbar injected
                  server-side instead of via userscript:
                </p>
                <CodeBlock
                  code={`# Nginx â€” add to your Komga location block:
sub_filter '</head>' '<script src="${scriptUrl}"></script></head>';
sub_filter_once on;`}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Script URL */}
      <Card>
        <CardHeader title="Script URL" />
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg bg-ink-900 px-3 py-2">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-ink-500" />
            <code className="flex-1 text-sm font-mono text-accent-400 break-all">
              {scriptUrl}
            </code>
          </div>
          <CopyButton text={scriptUrl} />
        </div>
        <p className="mt-2 text-xs text-ink-600">
          If KometaManga and Komga run on different origins, set{' '}
          <code className="text-ink-400">window.KOMETA_BASE</code> before loading the script.
        </p>
      </Card>
    </div>
  )
}

// â”€â”€ Status Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ConnectionTab() {
  const configQuery = useQuery({ queryKey: ['config'], queryFn: api.getConfig })
  const connectionQuery = useQuery({
    queryKey: ['connection'],
    queryFn: api.getConnected,
    refetchInterval: 10_000,
  })

  if (configQuery.isLoading) return <PageSpinner />
  if (configQuery.isError)
    return <ErrorState message="Failed to load config" onRetry={() => configQuery.refetch()} />

  return (
    <ConnectionSettingsForm
      config={configQuery.data!}
      connected={connectionQuery.data?.success ?? false}
    />
  )
}

function ConnectionSettingsForm({
  config,
  connected,
}: {
  config: KomfConfig
  connected: boolean
}) {
  const { status, error, save, dismissError } = useAutoSave()
  const [baseUri, setBaseUri] = useState(config.komga.baseUri)
  const [komgaUser, setKomgaUser] = useState(config.komga.komgaUser)
  const [komgaPassword, setKomgaPassword] = useState('')
  const locks = config.envLocks

  const testMutation = useMutation({
    mutationFn: () => api.getConnected(),
  })

  useEffect(() => {
    setBaseUri(config.komga.baseUri)
    setKomgaUser(config.komga.komgaUser)
  }, [config.komga.baseUri, config.komga.komgaUser])

  return (
    <div className="space-y-6">
      {/* Server section */}
      <SettingsSection
        title="Server"
        description="The URL where your Komga instance is running. Use the internal Docker hostname if both services are on the same Docker network."
        action={
          <div className="flex items-center gap-3">
            <SaveIndicator status={status} error={error} onDismiss={dismissError} />
            <StatusBadge status={connected ? 'connected' : 'disconnected'} />
          </div>
        }
      >
        {locks.komgaBaseUri && <EnvHybridHint envName="KOMF_KOMGA_BASE_URI" />}
        <TextField
          label="Base URI"
          value={baseUri}
          type="url"
          placeholder="http://komga:25600"
          description="e.g. http://komga:25600 (Docker) or http://your-server:25600 (LAN)"
          onChange={(v) => {
            setBaseUri(v)
            save({ komga: { baseUri: v } })
          }}
        />

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            loading={testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            Test Connection
          </Button>
          {testMutation.isSuccess && (
            <span className="flex items-center gap-1.5 text-xs font-medium">
              {testMutation.data.success ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Connection successful</span>
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-red-400">
                    {testMutation.data.errorMessage || `HTTP ${testMutation.data.httpStatusCode}`}
                  </span>
                </>
              )}
            </span>
          )}
          {testMutation.isError && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
              <XCircle className="h-3.5 w-3.5" />
              Connection failed
            </span>
          )}
        </div>
      </SettingsSection>

      {/* Credentials section */}
      <SettingsSection
        title="Credentials"
        description="The Komga account KometaManga uses to authenticate. This user needs admin privileges for metadata operations."
      >
        {(locks.komgaUser || locks.komgaPassword) && (
          <EnvHybridHint envName={locks.komgaUser && locks.komgaPassword ? 'KOMF_KOMGA_USER / KOMF_KOMGA_PASSWORD' : (locks.komgaUser ? 'KOMF_KOMGA_USER' : 'KOMF_KOMGA_PASSWORD')} />
        )}
        <TextField
          label="Username"
          value={komgaUser}
          placeholder="komf@komga.org"
          description="Komga user email or username."
          onChange={(v) => {
            setKomgaUser(v)
            save({ komga: { komgaUser: v } })
          }}
        />

        <TextField
          label="Password"
          value={komgaPassword}
          type="password"
          placeholder="••••••••"
          description="Leave empty to keep the current password."
          onChange={(v) => {
            setKomgaPassword(v)
            if (v) save({ komga: { komgaPassword: v } })
          }}
        />
      </SettingsSection>

      {/* Info box */}
      <Card>
        <div className="flex gap-3 text-sm text-ink-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p>
              The <strong className="text-ink-200">Base URI</strong> is the address that the{' '}
              <strong className="text-ink-200">server</strong> (backend) uses to reach Komga â€” not the
              browser. If both containers are on the same Docker network,{' '}
              <code className="text-ink-300">http://komga:25600</code> is correct even though your
              browser can't open it.
            </p>
            <p className="mt-2">
              To browse Komga from your browser, use the <strong className="text-ink-200">Browse</strong>{' '}
              tab â€” it goes through the built-in reverse proxy automatically.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

function EnvHybridHint({ envName }: { envName: string }) {
  return (
    <p className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-300">
      Initialized from <span className="font-mono">{envName}</span> — you can override it here and it will be saved to config.
    </p>
  )
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function FeatureChip({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-ink-800/30 bg-ink-900/40 p-3">
      <div className="mt-0.5 text-accent-400">{icon}</div>
      <div>
        <p className="text-xs font-semibold text-ink-200">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">{desc}</p>
      </div>
    </div>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs font-mono text-ink-300 leading-relaxed">
        {code}
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton text={code} />
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-400" />
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copy
        </>
      )}
    </Button>
  )
}