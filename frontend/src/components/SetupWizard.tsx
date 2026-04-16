import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type ProvidersConfigUpdateRequest } from '@/api/client'
import { Button } from '@/components/Button'
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Server,
  KeyRound,
  Sparkles,
  AlertTriangle,
  Shield,
  Eye,
  EyeOff,
  FolderOpen,
  Library,
  Loader2,
  BookOpen,
  Search,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from 'lucide-react'

interface SetupWizardProps {
  defaultBaseUri: string
  onComplete: () => void
}

type Step = 'welcome' | 'account' | 'server' | 'credentials' | 'downloads' | 'bridge' | 'providers' | 'done'

// ── Provider definitions ──

interface ProviderDef {
  key: string
  apiKey: keyof ProvidersConfigUpdateRequest
  name: string
  description: string
  color: string
  hasApiKey?: { label: string; placeholder: string; globalField: 'malClientId' | 'comicVineClientId' }
  hasExtra?: 'anilist' | 'mangabaka'
}

const ALL_PROVIDERS: ProviderDef[] = [
  { key: 'aniList', apiKey: 'aniList', name: 'AniList', description: 'Anime/manga database with rich metadata, tags, and scores', color: 'text-blue-400', hasExtra: 'anilist' },
  { key: 'mangaUpdates', apiKey: 'mangaUpdates', name: 'MangaUpdates', description: 'Comprehensive manga release tracking and metadata', color: 'text-orange-400' },
  { key: 'mangaDex', apiKey: 'mangaDex', name: 'MangaDex', description: 'Community-driven manga platform with multilingual covers', color: 'text-red-400' },
  { key: 'mal', apiKey: 'mal', name: 'MyAnimeList', description: 'The largest anime/manga database worldwide', color: 'text-blue-500', hasApiKey: { label: 'MAL Client ID', placeholder: 'Your MAL API client ID', globalField: 'malClientId' } },
  { key: 'mangaBaka', apiKey: 'mangaBaka', name: 'MangaBaka', description: 'Fast local database for manga lookups', color: 'text-pink-400', hasExtra: 'mangabaka' },
  { key: 'nautiljon', apiKey: 'nautiljon', name: 'Nautiljon', description: 'French anime/manga encyclopedia', color: 'text-cyan-400' },
  { key: 'comicVine', apiKey: 'comicVine', name: 'Comic Vine', description: 'The largest comic book wiki — ideal for Western comics', color: 'text-yellow-400', hasApiKey: { label: 'API Key', placeholder: 'Your Comic Vine API key', globalField: 'comicVineClientId' } },
  { key: 'bangumi', apiKey: 'bangumi', name: 'Bangumi', description: 'Chinese anime/manga/game tracking site', color: 'text-pink-300' },
  { key: 'bookWalker', apiKey: 'bookWalker', name: 'BookWalker', description: 'Japanese digital manga/light novel store', color: 'text-amber-400' },
  { key: 'yenPress', apiKey: 'yenPress', name: 'Yen Press', description: 'Major English manga/light novel publisher', color: 'text-emerald-400' },
  { key: 'kodansha', apiKey: 'kodansha', name: 'Kodansha', description: 'One of Japan\'s largest manga publishers', color: 'text-sky-400' },
  { key: 'viz', apiKey: 'viz', name: 'Viz Media', description: 'Major English manga publisher (Shonen Jump, etc.)', color: 'text-red-500' },
  { key: 'hentag', apiKey: 'hentag', name: 'Hentag', description: 'Adult manga tagging database', color: 'text-purple-400' },
  { key: 'webtoons', apiKey: 'webtoons', name: 'Webtoons', description: 'Popular webtoon/manhwa platform', color: 'text-green-400' },
]

interface ProviderState {
  enabled: boolean
  priority: number
}

interface ProviderPreset {
  name: string
  emoji: string
  description: string
  providers: Record<string, { enabled: boolean; priority: number }>
}

const PRESETS: ProviderPreset[] = [
  {
    name: 'Manga',
    emoji: '📚',
    description: 'Best for Japanese manga collections',
    providers: {
      aniList: { enabled: true, priority: 10 },
      mangaUpdates: { enabled: true, priority: 20 },
      mangaDex: { enabled: true, priority: 30 },
      mal: { enabled: true, priority: 40 },
      mangaBaka: { enabled: true, priority: 50 },
      nautiljon: { enabled: false, priority: 60 },
      comicVine: { enabled: false, priority: 70 },
      bangumi: { enabled: false, priority: 80 },
      bookWalker: { enabled: false, priority: 90 },
      yenPress: { enabled: false, priority: 100 },
      kodansha: { enabled: false, priority: 110 },
      viz: { enabled: false, priority: 120 },
      hentag: { enabled: false, priority: 130 },
      webtoons: { enabled: false, priority: 140 },
    },
  },
  {
    name: 'Comics',
    emoji: '🦸',
    description: 'Best for Western comic book collections',
    providers: {
      comicVine: { enabled: true, priority: 10 },
      mangaUpdates: { enabled: true, priority: 20 },
      aniList: { enabled: false, priority: 30 },
      mangaDex: { enabled: false, priority: 40 },
      mal: { enabled: false, priority: 50 },
      mangaBaka: { enabled: false, priority: 60 },
      nautiljon: { enabled: false, priority: 70 },
      bangumi: { enabled: false, priority: 80 },
      bookWalker: { enabled: false, priority: 90 },
      yenPress: { enabled: false, priority: 100 },
      kodansha: { enabled: false, priority: 110 },
      viz: { enabled: false, priority: 120 },
      hentag: { enabled: false, priority: 130 },
      webtoons: { enabled: false, priority: 140 },
    },
  },
  {
    name: 'Light Novel',
    emoji: '📖',
    description: 'Best for light novel / novel collections',
    providers: {
      aniList: { enabled: true, priority: 10 },
      mangaUpdates: { enabled: true, priority: 20 },
      mal: { enabled: true, priority: 30 },
      bookWalker: { enabled: true, priority: 40 },
      yenPress: { enabled: true, priority: 50 },
      mangaDex: { enabled: false, priority: 60 },
      mangaBaka: { enabled: false, priority: 70 },
      nautiljon: { enabled: false, priority: 80 },
      comicVine: { enabled: false, priority: 90 },
      bangumi: { enabled: false, priority: 100 },
      kodansha: { enabled: false, priority: 110 },
      viz: { enabled: false, priority: 120 },
      hentag: { enabled: false, priority: 130 },
      webtoons: { enabled: false, priority: 140 },
    },
  },
  {
    name: 'Webtoon',
    emoji: '📱',
    description: 'Best for webtoon / manhwa collections',
    providers: {
      aniList: { enabled: true, priority: 10 },
      mangaUpdates: { enabled: true, priority: 20 },
      mangaDex: { enabled: true, priority: 30 },
      webtoons: { enabled: true, priority: 40 },
      mangaBaka: { enabled: true, priority: 50 },
      mal: { enabled: false, priority: 60 },
      nautiljon: { enabled: false, priority: 70 },
      comicVine: { enabled: false, priority: 80 },
      bangumi: { enabled: false, priority: 90 },
      bookWalker: { enabled: false, priority: 100 },
      yenPress: { enabled: false, priority: 110 },
      kodansha: { enabled: false, priority: 120 },
      viz: { enabled: false, priority: 130 },
      hentag: { enabled: false, priority: 140 },
    },
  },
]

function getDefaultProviderStates(): Record<string, ProviderState> {
  const states: Record<string, ProviderState> = {}
  ALL_PROVIDERS.forEach((p, i) => {
    states[p.key] = { enabled: false, priority: (i + 1) * 10 }
  })
  return states
}

export function SetupWizard({ defaultBaseUri, onComplete }: SetupWizardProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('welcome')
  const [baseUri, setBaseUri] = useState(defaultBaseUri || 'http://komga:25600')
  const [komgaUser, setKomgaUser] = useState('')
  const [komgaPassword, setKomgaPassword] = useState('')
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [downloadDir, setDownloadDir] = useState('/data')
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null)
  const [selectedLibraryPath, setSelectedLibraryPath] = useState<string | null>(null)
  const [providerStates, setProviderStates] = useState<Record<string, ProviderState>>(getDefaultProviderStates)
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({ malClientId: '', comicVineClientId: '' })
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  const setupAuthMutation = useMutation({
    mutationFn: () =>
      api.setupAuth({ username: authUsername, password: authPassword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-status'] })
      setStep('server')
    },
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateConfig({
        komga: { baseUri, komgaUser, komgaPassword },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] })
      queryClient.invalidateQueries({ queryKey: ['connection'] })
      testMutation.mutate()
    },
  })

  const testMutation = useMutation({
    mutationFn: () => api.getConnected(),
    onSuccess: (data) => {
      if (data.success) setStep('downloads')
    },
  })

  const saveDownloadMutation = useMutation({
    mutationFn: () =>
      api.updateConfig({
        download: {
          downloadDir,
          komgaLibraryId: selectedLibraryId,
          komgaLibraryPath: selectedLibraryPath,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] })
      setStep('bridge')
    },
  })

  const saveProvidersMutation = useMutation({
    mutationFn: () => {
      const defaultProviders: ProvidersConfigUpdateRequest = {}
      for (const prov of ALL_PROVIDERS) {
        const state = providerStates[prov.key]
        if (state) {
          const update: Record<string, unknown> = { enabled: state.enabled, priority: state.priority }
          ;(defaultProviders as Record<string, unknown>)[prov.apiKey] = update
        }
      }
      const globalKeys: Record<string, string | null> = {}
      if (apiKeys.malClientId) globalKeys.malClientId = apiKeys.malClientId
      if (apiKeys.comicVineClientId) globalKeys.comicVineClientId = apiKeys.comicVineClientId
      return api.updateConfig({
        metadataProviders: { ...globalKeys, defaultProviders },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] })
      setStep('done')
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950 py-6 sm:py-10">
      {/* Animated gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/3 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-accent-600/6 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-1/3 left-1/4 h-[500px] w-[500px] rounded-full bg-violet-600/5 blur-[100px]" />
        <div className="absolute right-0 top-1/3 h-[350px] w-[350px] rounded-full bg-amber-600/4 blur-[80px]" />
      </div>

      {/* Central setup layout */}
      <div className="relative z-10 flex w-full max-w-5xl items-start justify-center px-4">
        <div className="w-full max-w-xl px-2 sm:px-6">
          {/* Top brand row */}
          <div className="mb-6 flex flex-col items-center gap-3 sm:mb-7">
            <div className="relative h-16 w-16 sm:h-20 sm:w-20">
              <div className="absolute inset-0 rounded-2xl bg-accent-500/15 blur-xl" />
              <img
                src="/logo.png"
                alt="KometaManga"
                className="relative h-16 w-16 rounded-2xl shadow-lg shadow-accent-600/20 sm:h-20 sm:w-20"
              />
            </div>
            <img
              src="/name.png"
              alt="KometaManga"
              className="h-8 w-auto object-contain sm:h-10"
            />
          </div>

        {/* Step indicator */}
        {step !== 'welcome' && step !== 'done' && (
          <div className="mb-8">
            {(() => {
              const stepOrder = ['account', 'server', 'credentials', 'downloads', 'bridge', 'providers'] as const
              const stepLabels = ['Account', 'Server', 'Credentials', 'Downloads', 'Extras', 'Providers']
              const currentIdx = stepOrder.indexOf(step as typeof stepOrder[number])
              const progress = ((currentIdx) / (stepOrder.length - 1)) * 100
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-ink-500">
                    <span>Step {currentIdx + 1} of {stepOrder.length}</span>
                    <span className="font-medium text-ink-300">{stepLabels[currentIdx]}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-500 transition-all duration-500 ease-out"
                      style={{ width: `${Math.max(progress, 8)}%` }}
                    />
                  </div>
                  <div className="flex justify-between">
                    {stepOrder.map((s, i) => {
                      const isCompleted = i < currentIdx
                      const isCurrent = i === currentIdx
                      return (
                        <div
                          key={s}
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                            isCurrent
                              ? 'bg-accent-600 text-white ring-2 ring-accent-500/30'
                              : isCompleted
                                ? 'bg-emerald-600/20 text-emerald-400'
                                : 'bg-ink-800/60 text-ink-600'
                          }`}
                        >
                          {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Card */}
        <div className="relative rounded-3xl border border-ink-800/40 bg-ink-900/90 p-7 shadow-2xl shadow-black/50 backdrop-blur-md sm:p-9">
          <div className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br from-accent-500/8 via-transparent to-violet-500/8 opacity-60" />
          {step === 'welcome' && (
            <WelcomeStep onNext={() => setStep('account')} />
          )}
          {step === 'account' && (
            <AccountStep
              username={authUsername}
              password={authPassword}
              onUsernameChange={setAuthUsername}
              onPasswordChange={setAuthPassword}
              onNext={() => {
                if (authUsername.trim() && authPassword.length >= 4) {
                  setupAuthMutation.mutate()
                } else {
                  // Skip auth setup
                  setStep('server')
                }
              }}
              onSkip={() => setStep('server')}
              saving={setupAuthMutation.isPending}
              error={setupAuthMutation.isError ? (setupAuthMutation.error as Error).message : null}
            />
          )}
          {step === 'server' && (
            <ServerStep
              baseUri={baseUri}
              onChange={setBaseUri}
              onNext={() => setStep('credentials')}
            />
          )}
          {step === 'credentials' && (
            <CredentialsStep
              komgaUser={komgaUser}
              komgaPassword={komgaPassword}
              onUserChange={setKomgaUser}
              onPasswordChange={setKomgaPassword}
              onBack={() => setStep('server')}
              onSave={() => saveMutation.mutate()}
              saving={saveMutation.isPending || testMutation.isPending}
              error={
                saveMutation.isError
                  ? (saveMutation.error as Error).message
                  : testMutation.isSuccess && !testMutation.data?.success
                    ? testMutation.data?.errorMessage || `HTTP ${testMutation.data?.httpStatusCode}`
                    : null
              }
            />
          )}
          {step === 'downloads' && (
            <DownloadsStep
              downloadDir={downloadDir}
              onDirChange={setDownloadDir}
              selectedLibraryId={selectedLibraryId}
              onLibrarySelect={(libId, libPath) => {
                setSelectedLibraryId(libId)
                setSelectedLibraryPath(libPath)
                if (libPath) setDownloadDir(libPath)
              }}
              onBack={() => setStep('credentials')}
              onNext={() => saveDownloadMutation.mutate()}
              onSkip={() => setStep('bridge')}
              saving={saveDownloadMutation.isPending}
              error={saveDownloadMutation.isError ? (saveDownloadMutation.error as Error).message : null}
            />
          )}
          {step === 'bridge' && (
            <BridgeStep
              onConfigure={() => setStep('providers')}
              onSkip={() => setStep('done')}
            />
          )}
          {step === 'providers' && (
            <ProvidersStep
              providerStates={providerStates}
              onProviderStatesChange={setProviderStates}
              apiKeys={apiKeys}
              onApiKeysChange={setApiKeys}
              selectedPreset={selectedPreset}
              onPresetChange={setSelectedPreset}
              onBack={() => setStep('bridge')}
              onSave={() => saveProvidersMutation.mutate()}
              saving={saveProvidersMutation.isPending}
              error={saveProvidersMutation.isError ? (saveProvidersMutation.error as Error).message : null}
            />
          )}
          {step === 'done' && <DoneStep onComplete={onComplete} />}
        </div>

        {/* Hero below card */}
        <div className="mt-7 flex justify-center sm:mt-8">
          <img
            src="/hero.png"
            alt=""
            className="h-44 w-auto rounded-xl object-contain opacity-90 drop-shadow-lg sm:h-52"
          />
        </div>
        </div>
      </div>
    </div>
  )
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-600/10 ring-1 ring-accent-500/20">
        <Sparkles className="h-7 w-7 text-accent-400" />
      </div>
      <h2 className="mb-2 font-display text-2xl font-bold text-ink-100">
        Welcome to KometaManga
      </h2>
      <p className="mb-2 text-sm leading-relaxed text-ink-400">
        Your Komga companion for metadata, downloads, and automation.
      </p>
      <p className="mb-6 text-xs text-ink-500">
        We'll set up your account, connect to Komga, and configure providers. Takes about a minute.
      </p>
      <Button size="lg" onClick={onNext} className="w-full">
        Get Started <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function AccountStep({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onNext,
  onSkip,
  saving,
  error,
}: {
  username: string
  password: string
  onUsernameChange: (v: string) => void
  onPasswordChange: (v: string) => void
  onNext: () => void
  onSkip: () => void
  saving: boolean
  error: string | null
}) {
  const [showPassword, setShowPassword] = useState(false)
  const canCreate = username.trim() !== '' && password.length >= 4

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10">
          <Shield className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-ink-100">Create Account</h2>
          <p className="text-xs text-ink-500">Protect your KometaManga instance</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-300">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            placeholder="admin"
            autoComplete="username"
            autoFocus
            className="w-full rounded-xl border border-ink-700 bg-ink-800/50 px-4 py-3 text-sm text-ink-100 placeholder-ink-600 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-300">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="Min. 4 characters"
              autoComplete="new-password"
              className="w-full rounded-xl border border-ink-700 bg-ink-800/50 px-4 py-3 pr-12 text-sm text-ink-100 placeholder-ink-600 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password.length > 0 && password.length < 4 && (
            <p className="mt-1 text-xs text-amber-400">Password must be at least 4 characters</p>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Button variant="ghost" size="md" onClick={onSkip}>
          Skip
        </Button>
        <Button size="lg" onClick={onNext} disabled={!canCreate || saving} loading={saving} className="flex-1">
          {saving ? 'Creating...' : 'Create Account'}
        </Button>
      </div>

      <p className="mt-3 text-center text-[11px] text-ink-500">
        You can also configure this later in Settings → Security
      </p>
    </div>
  )
}

function ServerStep({
  baseUri,
  onChange,
  onNext,
}: {
  baseUri: string
  onChange: (v: string) => void
  onNext: () => void
}) {
  const valid = baseUri.startsWith('http://') || baseUri.startsWith('https://')
  const isLocalhost = /localhost|127\.0\.0\.1/i.test(baseUri)

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600/10">
          <Server className="h-5 w-5 text-accent-400" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-ink-100">Server URL</h2>
          <p className="text-xs text-ink-500">Where is your Komga running?</p>
        </div>
      </div>

      <label className="mb-1.5 block text-sm font-medium text-ink-300">Komga Base URI</label>
      <input
        type="url"
        value={baseUri}
        onChange={(e) => onChange(e.target.value)}
        placeholder="http://komga:25600"
        className="mb-2 w-full rounded-xl border border-ink-700 bg-ink-800/50 px-4 py-3 text-sm text-ink-100 placeholder-ink-600 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
      />

      {isLocalhost && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="text-xs text-amber-400">
            <p className="font-medium">localhost doesn't work inside Docker!</p>
            <p className="mt-1 text-amber-400/80">
              Use your LAN IP (e.g.{' '}
              <code className="rounded bg-amber-900/30 px-1 py-0.5">http://192.168.x.x:25600</code>)
              or the Docker service name (e.g.{' '}
              <code className="rounded bg-amber-900/30 px-1 py-0.5">http://komga:25600</code>)
              if both containers are on the same Docker network.
            </p>
          </div>
        </div>
      )}

      {!isLocalhost && (
        <p className="mb-3 text-xs text-ink-500">
          Use <code className="rounded bg-ink-800 px-1 py-0.5 text-ink-400">http://komga:25600</code> if both
          run in Docker on the same network, or your LAN IP{' '}
          <code className="rounded bg-ink-800 px-1 py-0.5 text-ink-400">http://192.168.x.x:25600</code> otherwise.
          Do <strong>not</strong> use <code className="rounded bg-ink-800 px-1 py-0.5 text-ink-400">localhost</code>.
        </p>
      )}

      <Button size="lg" onClick={onNext} disabled={!valid} className="w-full">
        Next <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function CredentialsStep({
  komgaUser,
  komgaPassword,
  onUserChange,
  onPasswordChange,
  onBack,
  onSave,
  saving,
  error,
}: {
  komgaUser: string
  komgaPassword: string
  onUserChange: (v: string) => void
  onPasswordChange: (v: string) => void
  onBack: () => void
  onSave: () => void
  saving: boolean
  error: string | null
}) {
  const canSave = komgaUser.trim() !== '' && komgaPassword.trim() !== ''

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10">
          <KeyRound className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-ink-100">Credentials</h2>
          <p className="text-xs text-ink-500">Your Komga admin account</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-300">Username / Email</label>
          <input
            type="text"
            value={komgaUser}
            onChange={(e) => onUserChange(e.target.value)}
            placeholder="admin@komga.org"
            autoComplete="username"
            className="w-full rounded-xl border border-ink-700 bg-ink-800/50 px-4 py-3 text-sm text-ink-100 placeholder-ink-600 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-300">Password</label>
          <input
            type="password"
            value={komgaPassword}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full rounded-xl border border-ink-700 bg-ink-800/50 px-4 py-3 text-sm text-ink-100 placeholder-ink-600 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Button variant="ghost" size="md" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button size="lg" onClick={onSave} disabled={!canSave || saving} loading={saving} className="flex-1">
          {saving ? 'Connecting...' : 'Connect to Komga'}
        </Button>
      </div>
    </div>
  )
}

function DownloadsStep({
  downloadDir,
  onDirChange,
  selectedLibraryId,
  onLibrarySelect,
  onBack,
  onNext,
  onSkip,
  saving,
  error,
}: {
  downloadDir: string
  onDirChange: (v: string) => void
  selectedLibraryId: string | null
  onLibrarySelect: (libId: string | null, libPath: string | null) => void
  onBack: () => void
  onNext: () => void
  onSkip: () => void
  saving: boolean
  error: string | null
}) {
  const librariesQuery = useQuery({
    queryKey: ['libraries'],
    queryFn: api.getLibraries,
    staleTime: 60_000 * 5,
    retry: 1,
  })

  const [dirResult, setDirResult] = useState<{ exists: boolean; writable: boolean } | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!downloadDir.trim()) { setDirResult(null); return }
    const timer = setTimeout(async () => {
      setChecking(true)
      try {
        const r = await api.validateDir(downloadDir)
        setDirResult({ exists: r.exists, writable: r.writable })
      } catch {
        setDirResult(null)
      } finally {
        setChecking(false)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [downloadDir])

  const libraries = librariesQuery.data ?? []

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/10">
          <Library className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-ink-100">Target Library</h2>
          <p className="text-xs text-ink-500">Pick a Komga library where chapters will be downloaded.</p>
        </div>
      </div>

      {/* Komga Library picker (primary) */}
      {librariesQuery.isLoading && (
        <div className="mb-4 flex items-center gap-2 text-xs text-ink-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading Komga libraries…
        </div>
      )}

      {libraries.length > 0 && (
        <div className="mb-4 rounded-xl border border-ink-800/40 bg-ink-800/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-400">
            <Library className="h-3.5 w-3.5" />
            Komga Libraries
          </div>
          <div className="flex flex-wrap gap-2">
            {libraries.map((lib) => {
              const rootPath = lib.roots[0] ?? null
              const isSelected = selectedLibraryId === lib.id
              return (
                <button
                  key={lib.id}
                  onClick={() => {
                    if (isSelected) {
                      onLibrarySelect(null, null)
                    } else {
                      onLibrarySelect(lib.id, rootPath)
                    }
                  }}
                  className={`flex flex-col items-start rounded-lg px-3 py-2 text-left transition-all ${
                    isSelected
                      ? 'bg-accent-600/20 text-accent-400 ring-1 ring-accent-500/30'
                      : 'bg-ink-800/40 text-ink-400 hover:bg-ink-800/60 hover:text-ink-200'
                  }`}
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
      )}

      {libraries.length === 0 && !librariesQuery.isLoading && (
        <p className="mb-4 text-xs text-ink-500">
          No Komga libraries detected. You can set the download directory manually below, or go back and configure Komga first.
        </p>
      )}

      {/* Advanced path override */}
      <details className="mb-4 group">
        <summary className="cursor-pointer text-xs font-medium text-ink-400 hover:text-ink-300">
          <FolderOpen className="mr-1.5 inline h-3.5 w-3.5" />
          Advanced: Manual path override
        </summary>
        <div className="mt-2">
          <input
            type="text"
            value={downloadDir}
            onChange={(e) => onDirChange(e.target.value)}
            placeholder="/data"
            className="mb-2 w-full rounded-xl border border-ink-700 bg-ink-800/50 px-4 py-3 text-sm text-ink-100 placeholder-ink-600 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
          />

          {/* Directory validation */}
          {checking && (
            <div className="mb-2 flex items-center gap-2 text-xs text-ink-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking…
            </div>
          )}
          {dirResult && !checking && (
            <div className="mb-2 flex items-center gap-2 text-xs">
              {dirResult.exists && dirResult.writable ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Directory exists and is writable</span>
                </>
              ) : dirResult.exists ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-amber-400">Directory exists but is not writable</span>
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-red-400">Directory not found — it will be created on first download</span>
                </>
              )}
            </div>
          )}
        </div>
      </details>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" size="md" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button variant="ghost" size="md" onClick={onSkip}>
          Skip
        </Button>
        <Button size="lg" onClick={onNext} disabled={saving} loading={saving} className="flex-1">
          {saving ? 'Saving…' : 'Save & Continue'}
        </Button>
      </div>
    </div>
  )
}

function DoneStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/15 ring-1 ring-emerald-500/20">
        <CheckCircle2 className="h-8 w-8 text-emerald-400" />
      </div>
      <h2 className="mb-2 font-display text-2xl font-bold text-ink-100">You're all set!</h2>
      <p className="mb-4 text-sm leading-relaxed text-ink-400">
        KometaManga is connected and ready. Browse sources, download manga, and let the auto-downloader handle the rest.
      </p>
      <div className="mb-6 grid grid-cols-2 gap-2 text-left">
        <div className="rounded-xl bg-ink-800/30 px-3 py-2">
          <p className="text-[11px] font-medium text-ink-300">Browse Sources</p>
          <p className="text-[10px] text-ink-500">Search & download manga</p>
        </div>
        <div className="rounded-xl bg-ink-800/30 px-3 py-2">
          <p className="text-[11px] font-medium text-ink-300">Auto-Downloader</p>
          <p className="text-[10px] text-ink-500">Track & auto-fetch chapters</p>
        </div>
        <div className="rounded-xl bg-ink-800/30 px-3 py-2">
          <p className="text-[11px] font-medium text-ink-300">Metadata</p>
          <p className="text-[10px] text-ink-500">14+ providers for covers & info</p>
        </div>
        <div className="rounded-xl bg-ink-800/30 px-3 py-2">
          <p className="text-[11px] font-medium text-ink-300">Settings</p>
          <p className="text-[10px] text-ink-500">Notifications, scheduler & more</p>
        </div>
      </div>
      <Button size="lg" onClick={onComplete} className="w-full">
        Go to Dashboard <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ── Bridge Step ──

function BridgeStep({
  onConfigure,
  onSkip,
}: {
  onConfigure: () => void
  onSkip: () => void
}) {
  const coreItems = [
    { label: 'Admin account', icon: Shield },
    { label: 'Komga server', icon: Server },
    { label: 'Komga credentials', icon: KeyRound },
    { label: 'Download directory', icon: FolderOpen },
  ]

  return (
    <div>
      <div className="mb-5 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/20">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        </div>
        <h2 className="font-display text-lg font-bold text-ink-100">Core Setup Complete!</h2>
        <p className="mt-1 text-sm text-ink-400">The essentials are configured. Want to set up metadata providers?</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2">
        {coreItems.map(({ label }) => (
          <div key={label} className="flex items-center gap-2 rounded-xl bg-emerald-600/5 px-3 py-2.5 ring-1 ring-emerald-500/10">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-300">{label}</span>
          </div>
        ))}
      </div>

      <div className="mb-5 rounded-xl border border-accent-500/20 bg-accent-600/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-accent-400" />
          <span className="text-sm font-semibold text-ink-200">Metadata Providers</span>
        </div>
        <p className="text-xs leading-relaxed text-ink-400">
          Providers like <span className="text-ink-300">AniList</span>, <span className="text-ink-300">MangaUpdates</span>,
          and <span className="text-ink-300">MangaDex</span> fetch series info, covers, genres, and scores automatically.
          You can pick a preset or configure each provider individually.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" size="md" onClick={onSkip} className="flex-1">
          Skip for now
        </Button>
        <Button size="lg" onClick={onConfigure} className="flex-1">
          Configure Providers <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <p className="mt-3 text-center text-[11px] text-ink-500">
        You can always configure providers later in Settings → Providers
      </p>
    </div>
  )
}

// ── Providers Step ──

function ProvidersStep({
  providerStates,
  onProviderStatesChange,
  apiKeys,
  onApiKeysChange,
  selectedPreset,
  onPresetChange,
  onBack,
  onSave,
  saving,
  error,
}: {
  providerStates: Record<string, ProviderState>
  onProviderStatesChange: (states: Record<string, ProviderState>) => void
  apiKeys: Record<string, string>
  onApiKeysChange: (keys: Record<string, string>) => void
  selectedPreset: string | null
  onPresetChange: (preset: string | null) => void
  onBack: () => void
  onSave: () => void
  saving: boolean
  error: string | null
}) {
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const enabledCount = Object.values(providerStates).filter(s => s.enabled).length

  function applyPreset(preset: ProviderPreset) {
    const newStates = { ...providerStates }
    for (const [key, val] of Object.entries(preset.providers)) {
      newStates[key] = { enabled: val.enabled, priority: val.priority }
    }
    onProviderStatesChange(newStates)
    onPresetChange(preset.name)
  }

  function toggleProvider(key: string) {
    const cur = providerStates[key]
    if (!cur) return
    onProviderStatesChange({ ...providerStates, [key]: { ...cur, enabled: !cur.enabled } })
    onPresetChange(null)
  }

  function updatePriority(key: string, priority: number) {
    const cur = providerStates[key]
    if (!cur) return
    onProviderStatesChange({ ...providerStates, [key]: { ...cur, priority } })
    onPresetChange(null)
  }

  const filteredProviders = searchQuery
    ? ALL_PROVIDERS.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : ALL_PROVIDERS

  // Sort: enabled first, then by priority
  const sortedProviders = [...filteredProviders].sort((a, b) => {
    const aState = providerStates[a.key]
    const bState = providerStates[b.key]
    if (aState?.enabled && !bState?.enabled) return -1
    if (!aState?.enabled && bState?.enabled) return 1
    return (aState?.priority ?? 999) - (bState?.priority ?? 999)
  })

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600/10">
          <Search className="h-5 w-5 text-accent-400" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-ink-100">Metadata Providers</h2>
          <p className="text-xs text-ink-500">
            {enabledCount} provider{enabledCount !== 1 ? 's' : ''} enabled
            {selectedPreset && <span className="ml-1 text-accent-400">· {selectedPreset} preset</span>}
          </p>
        </div>
      </div>

      {/* Presets */}
      <div className="mb-4">
        <label className="mb-2 block text-xs font-medium text-ink-400">Quick Presets</label>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map(preset => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className={`rounded-xl px-3 py-2.5 text-left transition-all ${
                selectedPreset === preset.name
                  ? 'bg-accent-600/15 ring-1 ring-accent-500/30'
                  : 'bg-ink-800/30 hover:bg-ink-800/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{preset.emoji}</span>
                <span className={`text-sm font-semibold ${selectedPreset === preset.name ? 'text-accent-300' : 'text-ink-200'}`}>
                  {preset.name}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-ink-500">{preset.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      {ALL_PROVIDERS.length > 6 && (
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter providers…"
              className="w-full rounded-xl border border-ink-700/50 bg-ink-800/30 py-2 pl-9 pr-3 text-xs text-ink-200 placeholder-ink-600 outline-none focus:border-accent-500/50"
            />
          </div>
        </div>
      )}

      {/* Provider list */}
      <div className="mb-4 max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
        {sortedProviders.map(prov => {
          const state = providerStates[prov.key]
          if (!state) return null
          const isExpanded = expandedProvider === prov.key
          const hasDetails = !!prov.hasApiKey || !!prov.hasExtra

          return (
            <div
              key={prov.key}
              className={`rounded-xl border transition-colors ${
                state.enabled
                  ? 'border-accent-500/20 bg-ink-800/40'
                  : 'border-ink-800/30 bg-ink-900/30'
              }`}
            >
              {/* Provider header */}
              <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Priority indicator */}
                {state.enabled && (
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-ink-800/60 text-[10px] font-bold text-ink-400" title="Priority (lower = higher)">
                    {state.priority}
                  </span>
                )}
                {/* Name & description */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-semibold ${state.enabled ? 'text-ink-100' : 'text-ink-400'}`}>
                      {prov.name}
                    </span>
                    {prov.hasApiKey && state.enabled && !apiKeys[prov.hasApiKey.globalField] && (
                      <span className="rounded bg-amber-600/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                        KEY NEEDED
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-ink-500">{prov.description}</p>
                </div>

                {/* Expand button */}
                {hasDetails && state.enabled && (
                  <button
                    onClick={() => setExpandedProvider(isExpanded ? null : prov.key)}
                    className="rounded-lg p-1 text-ink-500 hover:bg-ink-700/50 hover:text-ink-300"
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                )}

                {/* Toggle */}
                <button
                  aria-label={`Toggle ${prov.name}`}
                  onClick={() => toggleProvider(prov.key)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    state.enabled ? 'bg-accent-600' : 'bg-ink-700'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      state.enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Expanded details */}
              {isExpanded && state.enabled && (
                <div className="border-t border-ink-800/30 px-3 pb-3 pt-2.5">
                  {/* Priority input */}
                  <div className="mb-2.5 flex items-center gap-2">
                    <GripVertical className="h-3 w-3 text-ink-600" />
                    <label className="text-[11px] font-medium text-ink-400">Priority</label>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      aria-label={`Priority for ${prov.name}`}
                      value={state.priority}
                      onChange={e => updatePriority(prov.key, parseInt(e.target.value) || 10)}
                      className="w-16 rounded-lg border border-ink-700/50 bg-ink-800/50 px-2 py-1 text-xs text-ink-200 outline-none focus:border-accent-500/50"
                    />
                    <span className="text-[10px] text-ink-600">Lower = higher priority</span>
                  </div>

                  {/* API key input */}
                  {prov.hasApiKey && (
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-ink-400">{prov.hasApiKey.label}</label>
                      <input
                        type="text"
                        value={apiKeys[prov.hasApiKey.globalField] || ''}
                        onChange={e => onApiKeysChange({ ...apiKeys, [prov.hasApiKey!.globalField]: e.target.value })}
                        placeholder={prov.hasApiKey.placeholder}
                        className="w-full rounded-lg border border-ink-700/50 bg-ink-800/50 px-3 py-1.5 text-xs text-ink-200 placeholder-ink-600 outline-none focus:border-accent-500/50"
                      />
                      {!apiKeys[prov.hasApiKey.globalField] && (
                        <p className="mt-1 text-[10px] text-amber-400/80">
                          {prov.key === 'mal'
                            ? 'Get your client ID from myanimelist.net/apiconfig'
                            : 'Get your API key from comicvine.gamespot.com/api'}
                        </p>
                      )}
                    </div>
                  )}

                  {/* AniList extra */}
                  {prov.hasExtra === 'anilist' && (
                    <p className="text-[10px] text-ink-500">
                      Tags score threshold and size limit can be fine-tuned in Settings → Providers.
                    </p>
                  )}

                  {/* MangaBaka extra */}
                  {prov.hasExtra === 'mangabaka' && (
                    <p className="text-[10px] text-ink-500">
                      Database mode (API vs local) can be configured in Settings → Providers.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" size="md" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button size="lg" onClick={onSave} disabled={saving} loading={saving} className="flex-1">
          {saving ? 'Saving…' : enabledCount > 0 ? `Save ${enabledCount} Provider${enabledCount !== 1 ? 's' : ''} & Finish` : 'Skip & Finish'}
        </Button>
      </div>

      <p className="mt-3 text-center text-[11px] text-ink-500">
        Full provider configuration (metadata fields, author roles, etc.) is available in Settings → Providers
      </p>
    </div>
  )
}
