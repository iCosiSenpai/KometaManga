import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  Activity,
  ArrowRight,
  Bell,
  BookOpen,
  Database,
  Download,
  Library,
  Radio,
  Shield,
  HardDrive,
} from 'lucide-react'
import { api } from '@/api/client'
import type { JobStatus } from '@/api/client'
import type { SourceHealthDto } from '@/api/sources'
import { DataRow, Eyebrow, HeroTitle, SectionTitle, StatColumn } from '@/components/atelier'
import { ErrorState } from '@/components/ErrorState'
import { PageSpinner } from '@/components/Spinner'

const PROVIDER_LABELS: Record<string, string> = {
  mangaUpdates: 'MangaUpdates',
  mal: 'MAL',
  nautiljon: 'Nautiljon',
  aniList: 'AniList',
  yenPress: 'Yen Press',
  kodansha: 'Kodansha',
  viz: 'VIZ',
  bookWalker: 'BookWalker',
  mangaDex: 'MangaDex',
  bangumi: 'Bangumi',
  comicVine: 'ComicVine',
  hentag: 'HenTag',
  mangaBaka: 'MangaBaka',
  webtoons: 'Webtoons',
}

const HEALTH_RANK: Record<SourceHealthDto['status'], number> = {
  RED: 0,
  YELLOW: 1,
  GREEN: 2,
}

const JOB_LABEL: Record<JobStatus, string> = {
  COMPLETED: 'completato',
  FAILED: 'fallito',
  RUNNING: 'in corso',
}

const EMPTY_LIBRARIES: Array<{ id: string; name: string; roots: string[] }> = []
const EMPTY_SOURCE_HEALTH: SourceHealthDto[] = []
const EMPTY_JOBS: { id: string; status: JobStatus; message: string | null; seriesId: string; startedAt: string }[] = []

export function DashboardPage() {
  const authQuery = useQuery({
    queryKey: ['auth-status'],
    queryFn: api.getAuthStatus,
    staleTime: 60_000 * 5,
    retry: false,
  })

  const connectionQuery = useQuery({
    queryKey: ['connection'],
    queryFn: api.getConnected,
    refetchInterval: 15_000,
  })

  const librariesQuery = useQuery({
    queryKey: ['libraries'],
    queryFn: api.getLibraries,
    enabled: connectionQuery.data?.success === true,
  })

  const recentJobsQuery = useQuery({
    queryKey: ['jobs', 'recent'],
    queryFn: () => api.getJobs({ page: 1, pageSize: 50 }),
    refetchInterval: 10_000,
  })

  const configQuery = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
  })

  const downloadStatusQuery = useQuery({
    queryKey: ['download-status'],
    queryFn: api.getDownloadStatus,
    refetchInterval: 10_000,
  })

  const autoDownloaderQuery = useQuery({
    queryKey: ['auto-downloader-status'],
    queryFn: api.getAutoDownloaderStatus,
    refetchInterval: 30_000,
  })

  const storageQuery = useQuery({
    queryKey: ['storage-stats'],
    queryFn: api.getStorageStats,
    refetchInterval: 60_000,
  })

  const healthQuery = useQuery({
    queryKey: ['manga-sources-health'],
    queryFn: api.getSourcesHealth,
    refetchInterval: 60_000,
  })

  const versionQuery = useQuery({
    queryKey: ['version'],
    queryFn: api.getVersion,
    refetchInterval: 1000 * 60 * 60,
  })

  const isConnected = connectionQuery.data?.success ?? false
  const libraries = librariesQuery.data ?? EMPTY_LIBRARIES
  const recentJobs = recentJobsQuery.data?.content ?? EMPTY_JOBS
  const config = configQuery.data
  const healthEntries = healthQuery.data ?? EMPTY_SOURCE_HEALTH
  const storage = storageQuery.data
  const version = versionQuery.data
  const username = authQuery.data?.username ?? null

  const libraryRootCount = useMemo(
    () => libraries.reduce((sum, library) => sum + library.roots.length, 0),
    [libraries],
  )

  const jobStats = useMemo(
    () => ({
      completed: recentJobs.filter((job) => job.status === 'COMPLETED').length,
      failed: recentJobs.filter((job) => job.status === 'FAILED').length,
      running: recentJobs.filter((job) => job.status === 'RUNNING').length,
    }),
    [recentJobs],
  )

  const sparklineData = useMemo(() => buildSparklineData(recentJobs), [recentJobs])

  const enabledProviders = useMemo(
    () =>
      config
        ? Object.values(config.metadataProviders.defaultProviders).filter(
            (provider) => provider && typeof provider === 'object' && 'enabled' in provider && provider.enabled,
          ).length
        : 0,
    [config],
  )

  const enabledProviderNames = useMemo(
    () =>
      config
        ? Object.entries(config.metadataProviders.defaultProviders)
            .filter(([, provider]) => provider && typeof provider === 'object' && 'enabled' in provider && provider.enabled)
            .map(([key]) => PROVIDER_LABELS[key] ?? key)
        : [],
    [config],
  )

  const healthCounts = useMemo(
    () => ({
      stable: healthEntries.filter((e) => e.status === 'GREEN').length,
      watch: healthEntries.filter((e) => e.status === 'YELLOW').length,
      down: healthEntries.filter((e) => e.status === 'RED').length,
    }),
    [healthEntries],
  )

  const sourceRows = useMemo(
    () =>
      [...healthEntries].sort((l, r) => {
        const rankDelta = HEALTH_RANK[l.status] - HEALTH_RANK[r.status]
        if (rankDelta !== 0) return rankDelta
        return l.sourceId.localeCompare(r.sourceId)
      }),
    [healthEntries],
  )

  const discordCount = config?.notifications.discord.webhooks?.length ?? 0
  const appriseCount = config?.notifications.apprise.urls?.length ?? 0
  const activeRules = autoDownloaderQuery.data?.activeRulesCount ?? 0
  const queueSize = downloadStatusQuery.data?.queueSize ?? 0
  const completedToday = downloadStatusQuery.data?.completedToday ?? 0
  const failedDownloads = downloadStatusQuery.data?.failedCount ?? 0
  const totalChannels = discordCount + appriseCount

  const greeting = useMemo(getGreeting, [])
  const hasWarnings =
    failedDownloads > 0 ||
    healthCounts.down > 0 ||
    healthCounts.watch > 0 ||
    jobStats.failed > 0
  const systemStatus: 'online' | 'warn' | 'offline' = !isConnected
    ? 'offline'
    : hasWarnings
      ? 'warn'
      : 'online'
  const oneLiner = buildOneLiner({
    isConnected,
    failedDownloads,
    healthDown: healthCounts.down,
    jobsRunning: jobStats.running,
    queueSize,
    librariesCount: libraries.length,
  })
  const nextAction = buildNextAction({
    isConnected,
    failedDownloads,
    healthDown: healthCounts.down,
    jobsFailed: jobStats.failed,
    queueSize,
    activeRules,
  })

  if (connectionQuery.isLoading) return <PageSpinner />
  if (connectionQuery.isError) {
    return (
      <ErrorState
        message="Il backend non risponde."
        hint="La dashboard si sveglia quando il server è online."
        onRetry={() => connectionQuery.refetch()}
      />
    )
  }

  return (
    <div className="font-sans animate-page-in ma-stagger space-y-10 pb-12 md:space-y-14">
      {/* HERO */}
      <section className="relative">
        <div className="flex flex-wrap items-center gap-3">
          <Eyebrow jp="ダッシュボード" en="Dashboard" />
          <StatusDot status={systemStatus} hasWarnings={hasWarnings} />
          <VersionChip current={version?.current} updateAvailable={version?.updateAvailable} latest={version?.latest} releaseUrl={version?.releaseUrl} />
        </div>
        <HeroTitle className="mt-5">
          {greeting}{username ? `, ${capitalize(username)}` : ''}.
        </HeroTitle>
        <p className="mt-4 max-w-[34rem] font-serif italic text-[20px] leading-[1.4] ma-muted sm:text-[22px]">
          {oneLiner}
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link to={nextAction.to} className="ma-cta group">
            <span className="text-[10px] uppercase tracking-[0.22em] opacity-70">Prossimo passo</span>
            <span className="opacity-30" aria-hidden>·</span>
            <span className="font-medium">{nextAction.label}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/sources" className="ma-quick">
            <BookOpen className="h-3.5 w-3.5" />
            Sfoglia sorgenti
          </Link>
          <Link to="/jobs" className="ma-quick">
            <Activity className="h-3.5 w-3.5" />
            Job recenti
          </Link>
        </div>
      </section>

      {/* STATO / STATE TRIO */}
      <section>
        <SectionTitle title="Stato" jp="状態" />
        <div className="mt-2 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          <StatColumn
            label="In coda"
            value={queueSize}
            unit={`${completedToday} completati oggi`}
            accent={queueSize > 0}
            to="/downloads"
          />
          <StatColumn
            label="Sorgenti"
            value={`${healthCounts.stable}/${healthEntries.length || '—'}`}
            unit={
              healthCounts.down > 0
                ? `${healthCounts.down} offline`
                : healthCounts.watch > 0
                  ? `${healthCounts.watch} da tenere d'occhio`
                  : healthEntries.length === 0
                    ? 'nessuna telemetria'
                    : 'tutte stabili'
            }
            accent={healthCounts.down > 0}
            to="/settings/sources"
          />
          <StatColumn
            label="Librerie"
            value={libraries.length}
            unit={`${libraryRootCount} percorsi radice`}
            to="/libraries"
          />
        </div>
      </section>

      {/* ATTIVITÀ / ACTIVITY */}
      <section>
        <SectionTitle title="Attività" jp="活動" />
        <div className="mt-2 grid grid-cols-1 gap-14 xl:grid-cols-[1.35fr_1fr] xl:gap-16">
          {/* Left column */}
          <div className="space-y-14">
            {/* Jobs block */}
            <div>
              <SectionTitle
                title="Job recenti"
                jp="最近"
                size="md"
                action={{ label: 'Tutti i job', to: '/jobs' }}
              />
              <div className="flex items-center justify-end gap-5 -mt-2 mb-4 font-opsMono text-[11px] uppercase tracking-[0.18em]">
                <span className="ma-faint">
                  OK <span className="ma-text">{jobStats.completed}</span>
                </span>
                <span className="ma-faint">
                  KO <span className={clsx(jobStats.failed > 0 ? 'ma-accent' : 'ma-text')}>{jobStats.failed}</span>
                </span>
                <span className="ma-faint">
                  Live <span className="ma-text">{jobStats.running}</span>
                </span>
              </div>
              <Sparkline data={sparklineData} />
              <div className="mt-5">
                {recentJobs.slice(0, 6).map((job) => (
                  <TimelineRow key={job.id} job={job} />
                ))}
                {recentJobs.length === 0 && <EmptyLine text="Nessun job ancora registrato." />}
              </div>
            </div>

            {/* Sources block */}
            <div>
              <SectionTitle
                title="Sorgenti"
                jp="ソース"
                size="md"
                action={{ label: 'Gestisci', to: '/settings/sources' }}
              />
              <div className="flex items-center justify-end -mt-2 mb-4">
                <span className="font-opsMono text-[11px] uppercase tracking-[0.18em] ma-faint">
                  {healthCounts.stable} stabili · {healthCounts.watch} watch · {healthCounts.down} down
                </span>
              </div>
              <div>
                {sourceRows.map((entry) => (
                  <SourceRow key={entry.sourceId} entry={entry} />
                ))}
                {sourceRows.length === 0 && <EmptyLine text="Nessuna telemetria ancora disponibile." />}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-14">
            {/* System posture */}
            <div>
              <SectionTitle title="Stato sistema" jp="システム" size="md" />
              <div>
                <DataRow
                  icon={<Database className="h-3.5 w-3.5" />}
                  title="Komga"
                  note={isConnected ? 'Connesso e pronto' : 'Nessuna risposta'}
                  value={isConnected ? 'online' : 'offline'}
                  tone={isConnected ? 'ok' : 'accent'}
                  to="/komga"
                />
                <DataRow
                  icon={<Download className="h-3.5 w-3.5" />}
                  title="Download"
                  note={failedDownloads > 0 ? `${failedDownloads} falliti` : 'Tutto liscio'}
                  value={`${queueSize} in coda`}
                  tone={failedDownloads > 0 ? 'accent' : 'default'}
                  to="/downloads"
                />
                <DataRow
                  icon={<Radio className="h-3.5 w-3.5" />}
                  title="Auto-downloader"
                  note={activeRules === 0 ? 'Nessuna regola attiva' : 'Scansione periodica'}
                  value={`${activeRules} regol${activeRules === 1 ? 'a' : 'e'}`}
                  to="/downloads"
                />
                <DataRow
                  icon={<Bell className="h-3.5 w-3.5" />}
                  title="Notifiche"
                  note={
                    totalChannels === 0
                      ? 'Nessun canale configurato'
                      : `Discord ${discordCount} · Apprise ${appriseCount}`
                  }
                  value={totalChannels === 0 ? '—' : `${totalChannels} canal${totalChannels === 1 ? 'e' : 'i'}`}
                  to="/settings/notifications"
                />
                <DataRow
                  icon={<Shield className="h-3.5 w-3.5" />}
                  title="Provider metadata"
                  note={enabledProviderNames.slice(0, 4).join(' · ') || 'Nessuno attivo'}
                  value={`${enabledProviders}`}
                  to="/settings/providers"
                />
              </div>
            </div>

            {/* Storage block */}
            <div>
              <SectionTitle
                title="Archivio"
                jp="保管"
                size="md"
                action={{ label: 'Impostazioni', to: '/settings/download' }}
              />
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="font-serif italic text-[44px] leading-none ma-text">
                    {storage ? formatBytes(storage.usedBytes) : '—'}
                  </span>
                  <span className="ma-faint text-[12px] uppercase tracking-[0.2em] font-opsMono">
                    usati
                  </span>
                </div>
                <p className="mt-2 ma-muted text-[13px] truncate font-sans">
                  {storage?.downloadDir ?? 'In attesa del volume…'}
                </p>
                {storage && (
                  <div className="mt-5">
                    <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ background: 'var(--ma-hair)' }}>
                      <div
                        className="h-full ma-bg-accent"
                        style={{
                          width: `${Math.min(100, Math.max(2, (storage.usedBytes / Math.max(1, storage.usedBytes + storage.usableBytes)) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between font-opsMono text-[11px] uppercase tracking-[0.18em] ma-faint">
                      <span className="inline-flex items-center gap-1.5">
                        <HardDrive className="h-3 w-3" />
                        {storage.fileCount} file
                      </span>
                      <span>{formatBytes(storage.usableBytes)} liberi</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Libraries list */}
            <div>
              <SectionTitle
                title="Librerie"
                jp="書庫"
                size="md"
                action={{ label: 'Vedi tutte', to: '/libraries' }}
              />
              <div>
                {libraries.slice(0, 5).map((lib) => (
                  <DataRow
                    key={lib.id}
                    icon={<Library className="h-3.5 w-3.5" />}
                    title={lib.name}
                    note={lib.roots[0] ?? '—'}
                    value={`${lib.roots.length} root${lib.roots.length === 1 ? '' : 's'}`}
                    to="/libraries"
                  />
                ))}
                {libraries.length === 0 && <EmptyLine text="Nessuna libreria collegata." />}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────

function StatusDot({
  status,
  hasWarnings,
}: {
  status: 'online' | 'warn' | 'offline'
  hasWarnings: boolean
}) {
  const label =
    status === 'offline'
      ? 'komga offline'
      : status === 'warn'
        ? hasWarnings ? 'komga · attenzione' : 'komga online'
        : 'komga online'

  const dotClass = clsx(
    'relative inline-block h-2 w-2 rounded-full',
    status === 'online' && 'ma-bg-ok',
    status === 'warn' && 'ma-bg-warn',
    status === 'offline' && 'ma-bg-accent',
  )

  return (
    <Link
      to="/komga"
      className="group inline-flex items-center gap-2 font-opsMono text-[11px] uppercase tracking-[0.2em] ma-muted transition-colors hover:ma-text"
      title={
        status === 'offline'
          ? 'Komga non risponde — apri impostazioni'
          : status === 'warn'
            ? 'Online ma con avvisi aperti — controlla i dettagli'
            : 'Connesso e pronto'
      }
    >
      <span className={dotClass} aria-hidden>
        {status === 'warn' && (
          <span className="absolute inset-0 rounded-full ma-bg-warn opacity-60 animate-ping" />
        )}
      </span>
      {label}
    </Link>
  )
}

function VersionChip({
  current,
  updateAvailable,
  latest,
  releaseUrl,
}: {
  current?: string
  updateAvailable?: boolean
  latest?: string | null
  releaseUrl?: string | null
}) {
  if (!current) return null
  if (updateAvailable && latest) {
    return (
      <a
        href={releaseUrl ?? 'https://github.com/iCosiSenpai/KometaManga/releases'}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-opsMono text-[11px] uppercase tracking-[0.2em] ma-accent transition-opacity hover:opacity-80"
      >
        v{current} → {latest}
      </a>
    )
  }
  return (
    <span className="font-opsMono text-[11px] uppercase tracking-[0.2em] ma-faint">
      v{current}
    </span>
  )
}

function TimelineRow({
  job,
}: {
  job: { id: string; status: JobStatus; message: string | null; seriesId: string; startedAt: string }
}) {
  const isFailed = job.status === 'FAILED'
  const isRunning = job.status === 'RUNNING'

  return (
    <Link
      to="/jobs"
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b py-3 ma-hair last:border-b-0 transition-colors hover:bg-ma-surface/60 -mx-2 px-2 rounded-sm"
    >
      <span
        className={clsx(
          'font-opsMono text-[11px] uppercase tracking-[0.18em]',
          isFailed && 'ma-accent',
          !isFailed && 'ma-faint',
        )}
      >
        {formatTimeAgo(job.startedAt)}
      </span>
      <span className="min-w-0 truncate font-serif italic text-[16px] ma-text">
        {job.message || job.seriesId}
      </span>
      <span
        className={clsx(
          'font-opsMono text-[11px] uppercase tracking-[0.2em]',
          isFailed && 'ma-accent',
          isRunning && 'ma-text',
          !isFailed && !isRunning && 'ma-muted',
        )}
      >
        {JOB_LABEL[job.status]}
      </span>
    </Link>
  )
}

function SourceRow({ entry }: { entry: SourceHealthDto }) {
  const isDown = entry.status === 'RED'
  const isWatch = entry.status === 'YELLOW'

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b py-3 ma-hair last:border-b-0">
      <span
        className={clsx(
          'inline-block h-1.5 w-1.5 rounded-full',
          isDown && 'ma-bg-accent',
          isWatch && 'bg-current opacity-60',
          !isDown && !isWatch && 'bg-current opacity-25',
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="font-sans text-[14px] ma-text">{entry.sourceId}</p>
        <p className="mt-0.5 truncate font-sans text-[12px] ma-faint">
          {entry.error || (isDown ? 'Non risponde' : isWatch ? 'Latenza elevata' : 'Ciclo di risposta normale')}
        </p>
      </div>
      <span
        className={clsx(
          'font-opsMono text-[11px] uppercase tracking-[0.18em]',
          isDown ? 'ma-accent' : 'ma-muted',
        )}
      >
        {formatLatency(entry.latencyMs)}
      </span>
    </div>
  )
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="border-b py-5 ma-hair ma-faint font-serif italic text-[15px] last:border-b-0">
      {text}
    </p>
  )
}

interface SparklineDay {
  label: string
  completed: number
  failed: number
}

function Sparkline({ data, className }: { data: SparklineDay[]; className?: string }) {
  const maxValue = Math.max(1, ...data.map((d) => d.completed + d.failed))

  if (data.length === 0) {
    return <div className={clsx('ma-faint font-serif italic text-[15px]', className)}>Nessuna telemetria recente.</div>
  }

  return (
    <div className={clsx('flex h-20 items-end gap-2', className)}>
      {data.map((entry) => {
        const c = (entry.completed / maxValue) * 70
        const f = (entry.failed / maxValue) * 70
        const isToday = entry === data[data.length - 1]
        return (
          <div key={entry.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-16 w-full flex-col justify-end gap-[2px]">
              {f > 0 && <div className="w-full rounded-sm ma-bar-failed" style={{ height: `${f}px` }} />}
              {c > 0 && <div className="w-full rounded-sm ma-bar-complete" style={{ height: `${c}px` }} />}
            </div>
            <span
              className={clsx(
                'font-opsMono text-[10px] uppercase tracking-[0.18em]',
                isToday ? 'ma-text' : 'ma-faint',
              )}
            >
              {entry.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────

function buildSparklineData(jobs: { status: JobStatus; startedAt: string }[]): SparklineDay[] {
  const days: SparklineDay[] = []
  const now = new Date()
  for (let index = 6; index >= 0; index--) {
    const day = new Date(now)
    day.setDate(day.getDate() - index)
    const key = day.toISOString().slice(0, 10)
    const label = day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)
    const bucket: SparklineDay = { label, completed: 0, failed: 0 }
    for (const job of jobs) {
      if (job.startedAt.slice(0, 10) !== key) continue
      if (job.status === 'COMPLETED') bucket.completed += 1
      if (job.status === 'FAILED') bucket.failed += 1
    }
    days.push(bucket)
  }
  return days
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'È tardi'
  if (h < 13) return 'Buongiorno'
  if (h < 19) return 'Buon pomeriggio'
  return 'Buonasera'
}

function buildOneLiner(state: {
  isConnected: boolean
  failedDownloads: number
  healthDown: number
  jobsRunning: number
  queueSize: number
  librariesCount: number
}): string {
  const { isConnected, failedDownloads, healthDown, jobsRunning, queueSize, librariesCount } = state
  if (!isConnected) return 'Komga non risponde. Diamoci un\u2019occhiata insieme.'
  if (failedDownloads > 0) return 'Alcuni download hanno inciampato lungo la strada.'
  if (healthDown > 0) return `${healthDown} sorgent${healthDown > 1 ? 'i' : 'e'} offline — niente panico, capita.`
  if (jobsRunning > 0) return `${jobsRunning} lavor${jobsRunning > 1 ? 'i' : 'o'} in corso — rimani pure, respiro anch\u2019io.`
  if (queueSize > 0) return `${queueSize} capitol${queueSize > 1 ? 'i' : 'o'} in coda. Va bene così.`
  if (librariesCount === 0) return 'La libreria è ancora vuota. Cominciamo insieme.'
  return 'La tua libreria respira bene.'
}

function buildNextAction(state: {
  isConnected: boolean
  failedDownloads: number
  healthDown: number
  jobsFailed: number
  queueSize: number
  activeRules: number
}): { label: string; to: string } {
  const { isConnected, failedDownloads, healthDown, jobsFailed, queueSize, activeRules } = state
  if (!isConnected) return { label: 'Configura Komga', to: '/komga' }
  if (failedDownloads > 0) return { label: 'Rivedi i download', to: '/downloads' }
  if (healthDown > 0) return { label: 'Indaga le sorgenti', to: '/settings/sources' }
  if (jobsFailed > 0) return { label: 'Controlla i job falliti', to: '/jobs' }
  if (queueSize === 0 && activeRules === 0) return { label: 'Cerca nuovi titoli', to: '/sources' }
  if (queueSize > 0) return { label: 'Monitora la coda', to: '/downloads' }
  return { label: 'Aggiungi una regola auto', to: '/downloads' }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const base = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.floor(Math.log(bytes) / Math.log(base))
  return `${parseFloat((bytes / Math.pow(base, index)).toFixed(1))} ${sizes[index]}`
}

function formatLatency(latencyMs: number | null | undefined): string {
  if (latencyMs == null) return '—'
  if (latencyMs >= 1000) return `${(latencyMs / 1000).toFixed(1)}s`
  return `${latencyMs}ms`
}

function formatTimeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
  if (seconds < 60) return 'ora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}g`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
