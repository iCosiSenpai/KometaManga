import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import {
  Activity,
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Download,
  FolderOpen,
  HardDrive,
  Layers,
  Library,
  Radio,
  RefreshCcw,
  Shield,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import type { JobStatus } from '@/api/client'
import type { SourceHealthDto } from '@/api/sources'
import { Card } from '@/components/Card'
import { ErrorState } from '@/components/ErrorState'
import { PageSpinner } from '@/components/Spinner'

const JOB_META: Record<
  JobStatus,
  { label: string; pill: string; icon: ReactNode }
> = {
  COMPLETED: {
    label: 'Completed',
    pill: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  },
  FAILED: {
    label: 'Failed',
    pill: 'bg-red-500/10 text-red-300 ring-1 ring-red-500/20',
    icon: <XCircle className="h-4 w-4 text-red-400" />,
  },
  RUNNING: {
    label: 'Running',
    pill: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20',
    icon: <Clock3 className="h-4 w-4 animate-pulse-subtle text-amber-400" />,
  },
}

const HEALTH_META: Record<
  SourceHealthDto['status'],
  { label: string; pill: string; dot: string; rank: number }
> = {
  RED: {
    label: 'Down',
    pill: 'bg-red-500/10 text-red-300 ring-1 ring-red-500/20',
    dot: 'bg-red-400',
    rank: 0,
  },
  YELLOW: {
    label: 'Watch',
    pill: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20',
    dot: 'bg-amber-400',
    rank: 1,
  },
  GREEN: {
    label: 'Stable',
    pill: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20',
    dot: 'bg-emerald-400',
    rank: 2,
  },
}

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

const COMMAND_ACTIONS = [
  {
    to: '/sources',
    label: 'Browse Sources',
    note: 'Search titles, compare mirrors, and queue chapters.',
    icon: <BookOpen className="h-4 w-4" />,
    tone: 'accent' as const,
  },
  {
    to: '/downloads',
    label: 'Downloads & Auto',
    note: 'Queue, history, and auto-download rules in one place.',
    icon: <Download className="h-4 w-4" />,
    tone: 'sky' as const,
  },
  {
    to: '/jobs',
    label: 'Jobs',
    note: 'Inspect metadata runs and recent failures.',
    icon: <Activity className="h-4 w-4" />,
    tone: 'amber' as const,
  },
  {
    to: '/libraries',
    label: 'Libraries',
    note: 'Check shelves, roots, and library posture.',
    icon: <Library className="h-4 w-4" />,
    tone: 'emerald' as const,
  },
  {
    to: '/settings/providers',
    label: 'Providers',
    note: 'Rebalance metadata providers and defaults.',
    icon: <Layers className="h-4 w-4" />,
    tone: 'ink' as const,
  },
]

const EMPTY_LIBRARIES: Array<{ id: string; name: string; roots: string[] }> = []
const EMPTY_SOURCE_HEALTH: SourceHealthDto[] = []

export function DashboardPage() {
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
  const recentJobs = recentJobsQuery.data?.content ?? []
  const config = configQuery.data
  const healthEntries = healthQuery.data ?? EMPTY_SOURCE_HEALTH
  const storage = storageQuery.data
  const version = versionQuery.data

  const libraryRootCount = useMemo(
    () => libraries.reduce((sum, library) => sum + library.roots.length, 0),
    [libraries],
  )

  const jobStats = useMemo(
    () => {
      const recentJobs = recentJobsQuery.data?.content ?? []
      return {
        completed: recentJobs.filter((job) => job.status === 'COMPLETED').length,
        failed: recentJobs.filter((job) => job.status === 'FAILED').length,
        running: recentJobs.filter((job) => job.status === 'RUNNING').length,
      }
    },
    [recentJobsQuery.data?.content],
  )

  const sparklineData = useMemo(
    () => buildSparklineData(recentJobsQuery.data?.content ?? []),
    [recentJobsQuery.data?.content],
  )

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
            .slice(0, 4)
        : [],
    [config],
  )

  const healthCounts = useMemo(
    () => {
      const healthEntries = healthQuery.data ?? []
      return {
        stable: healthEntries.filter((entry) => entry.status === 'GREEN').length,
        watch: healthEntries.filter((entry) => entry.status === 'YELLOW').length,
        down: healthEntries.filter((entry) => entry.status === 'RED').length,
      }
    },
    [healthQuery.data],
  )

  const sourceRows = useMemo(
    () =>
      [...healthEntries].sort((left, right) => {
        const rankDelta = HEALTH_META[left.status].rank - HEALTH_META[right.status].rank
        if (rankDelta !== 0) return rankDelta
        return left.sourceId.localeCompare(right.sourceId)
      }),
    [healthEntries],
  )

  const discordCount = config?.notifications.discord.webhooks?.length ?? 0
  const appriseCount = config?.notifications.apprise.urls?.length ?? 0
  const activeRules = autoDownloaderQuery.data?.activeRulesCount ?? 0
  const queueSize = downloadStatusQuery.data?.queueSize ?? 0
  const completedToday = downloadStatusQuery.data?.completedToday ?? 0
  const failedDownloads = downloadStatusQuery.data?.failedCount ?? 0
  const eventListenerEnabled = config?.komga.eventListener.enabled ?? false
  const metadataProfile = config?.komga.metadataUpdate.default.libraryType ?? 'Unknown'

  if (connectionQuery.isLoading) return <PageSpinner />
  if (connectionQuery.isError) {
    return (
      <ErrorState
        message="Cannot reach backend"
        hint="The operations console needs the backend online before it can render live status."
        onRetry={() => connectionQuery.refetch()}
      />
    )
  }

  return (
    <div className="font-ops animate-page-in space-y-5 pb-10">
      <section className="rounded-2xl border border-ink-800/40 bg-ink-900/60 p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusFlag tone={isConnected ? 'emerald' : 'red'} label={isConnected ? 'Komga online' : 'Komga offline'} />
              <span className="rounded-full border border-ink-800/50 bg-ink-950/50 px-2.5 py-0.5 font-mono text-[11px] text-ink-500">
                v{version?.current ?? '...'}
              </span>
              {version?.updateAvailable && (
                <a
                  href="https://github.com/iCosiSenpai/KometaManga/releases"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-emerald-700/30 bg-emerald-950/20 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-950/40"
                >
                  {version.latest} available
                </a>
              )}
            </div>

            <div className="space-y-1.5">
              <h1 className="max-w-2xl text-2xl font-semibold tracking-[-0.03em] text-ink-50 sm:text-3xl">
                Operations Dashboard
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-ink-400">
                Queue pressure, source health, job activity, storage, and configuration at a glance.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <InlineAction to="/sources" icon={<BookOpen className="h-4 w-4" />} label="Search sources" />
            <InlineAction to="/jobs" icon={<Activity className="h-4 w-4" />} label="View jobs" />
          </div>
        </div>

        <div className="mt-5 grid gap-2.5 md:grid-cols-2 xl:grid-cols-5">
          <KpiTile label="Libraries" value={String(libraries.length)} note={`${libraryRootCount} root paths`} tone="ink" />
          <KpiTile label="Queue" value={String(queueSize)} note={`${completedToday} completed today`} tone="accent" />
          <KpiTile label="Recent runs" value={String(jobStats.running)} note={`${jobStats.failed} failed in the recent window`} tone="amber" />
          <KpiTile label="Sources down" value={String(healthCounts.down)} note={`${healthCounts.watch} degraded`} tone={healthCounts.down > 0 ? 'red' : 'emerald'} />
          <KpiTile
            label="Providers"
            value={String(enabledProviders)}
            note={enabledProviderNames.length > 0 ? enabledProviderNames.join(' / ') : 'No provider enabled'}
            tone="ink"
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <Card className="rounded-2xl border-ink-800/40 bg-ink-900/50 p-5 sm:p-6">
            <SectionHeader
              eyebrow="Quick Actions"
              title="Common moves"
              description="The routes you are most likely to need when something stalls."
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {COMMAND_ACTIONS.map((action) => (
                <CommandAction key={action.to} {...action} />
              ))}
            </div>
          </Card>

          <Card className="rounded-2xl border-ink-800/40 bg-ink-900/50 p-5 sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <SectionHeader
                eyebrow="Runtime"
                title="Recent job activity"
                description="Compact trend plus the latest processing events."
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <MiniStat label="Completed" value={jobStats.completed} tone="emerald" />
                <MiniStat label="Failed" value={jobStats.failed} tone="red" />
                <MiniStat label="Running" value={jobStats.running} tone="amber" />
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <Sparkline data={sparklineData} />

              <div className="space-y-2">
                {recentJobs.slice(0, 6).map((job) => (
                  <TimelineRow key={job.id} job={job} />
                ))}
                {recentJobs.length === 0 && (
                  <div className="rounded-xl border border-dashed border-ink-800/50 px-4 py-6 text-sm text-ink-500">
                    No recent jobs have been recorded yet.
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border-ink-800/40 bg-ink-900/50 p-5 sm:p-6">
            <SectionHeader
              eyebrow="Sources"
              title="Health matrix"
              description="Monitor latency and failures before jumping into search."
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MiniStat label="Stable" value={healthCounts.stable} tone="emerald" />
              <MiniStat label="Watch" value={healthCounts.watch} tone="amber" />
              <MiniStat label="Down" value={healthCounts.down} tone="red" />
            </div>

            <div className="mt-5 space-y-2">
              {sourceRows.map((entry) => (
                <SourceHealthRow key={entry.sourceId} entry={entry} />
              ))}
              {sourceRows.length === 0 && (
                <div className="rounded-xl border border-dashed border-ink-800/50 px-4 py-6 text-sm text-ink-500">
                  Health monitor has not produced source data yet.
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl border-ink-800/40 bg-ink-900/50 p-5 sm:p-6">
            <SectionHeader
              eyebrow="System"
              title="Posture"
              description="Operational status of the subsystems that matter most."
            />
            <div className="mt-5 space-y-2">
              <SystemRow
                icon={<Database className="h-4 w-4" />}
                label="Komga link"
                value={isConnected ? 'Connected' : 'Disconnected'}
                tone={isConnected ? 'emerald' : 'red'}
                note={isConnected ? 'Ready for library and import calls' : 'Backend sees no server'}
              />
              <SystemRow
                icon={<Download className="h-4 w-4" />}
                label="Download lane"
                value={`${queueSize} queued`}
                tone={failedDownloads > 0 ? 'amber' : 'ink'}
                note={`${failedDownloads} failed download${failedDownloads === 1 ? '' : 's'}`}
              />
              <SystemRow
                icon={<Download className="h-4 w-4" />}
                label="Auto-downloader"
                value={`${activeRules} active rules`}
                tone={activeRules > 0 ? 'emerald' : 'ink'}
                note="Background rule coverage"
              />
              <SystemRow
                icon={<Radio className="h-4 w-4" />}
                label="Event listener"
                value={eventListenerEnabled ? 'Enabled' : 'Disabled'}
                tone={eventListenerEnabled ? 'emerald' : 'ink'}
                note="Komga event ingestion"
              />
              <SystemRow
                icon={<Bell className="h-4 w-4" />}
                label="Notifications"
                value={`${discordCount} Discord / ${appriseCount} Apprise`}
                tone={discordCount + appriseCount > 0 ? 'emerald' : 'ink'}
                note="Outbound alert channels"
              />
              <SystemRow
                icon={<Shield className="h-4 w-4" />}
                label="Metadata profile"
                value={metadataProfile}
                tone="ink"
                note="Default update mode"
              />
            </div>
          </Card>

          <Card className="rounded-2xl border-ink-800/40 bg-ink-900/50 p-5 sm:p-6">
            <SectionHeader
              eyebrow="Storage"
              title="Disk and release"
              description="The two things that usually hurt only after you stop watching them."
            />
            <div className="mt-5 space-y-3">
              <ReadoutBlock
                icon={<HardDrive className="h-4 w-4" />}
                label="Used space"
                value={storage ? formatBytes(storage.usedBytes) : 'Sampling'}
                note={storage?.downloadDir ?? 'Waiting for storage route'}
              />
              <ReadoutBlock
                icon={<RefreshCcw className="h-4 w-4" />}
                label="Release"
                value={version?.updateAvailable ? `Behind ${version.latest}` : 'Current'}
                note={version ? `Running ${version.current}` : 'Waiting for version route'}
              />
            </div>

            <a
              href="https://github.com/iCosiSenpai/KometaManga/releases"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent-300 transition-colors hover:text-accent-200"
            >
              Open release notes
              <ArrowRight className="h-4 w-4" />
            </a>
          </Card>

          <Card className="rounded-2xl border-ink-800/40 bg-ink-900/50 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <SectionHeader
                eyebrow="Libraries"
                title="Attached shelves"
                description="A quick audit of the libraries and root paths currently visible to the app."
              />
              <Link
                to="/libraries"
                className="mt-1 inline-flex items-center gap-1 text-sm text-ink-400 transition-colors hover:text-ink-200"
              >
                Open
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 space-y-2">
              {libraries.slice(0, 6).map((library) => (
                <LibraryRow key={library.id} library={library} />
              ))}
              {libraries.length === 0 && (
                <div className="rounded-xl border border-dashed border-ink-800/50 px-4 py-6 text-sm text-ink-500">
                  No libraries available from Komga.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatusFlag({
  label,
  tone,
}: {
  label: string
  tone: 'emerald' | 'red'
}) {
  return (
    <span
      className={clsx(
        'rounded-full px-3 py-1 text-xs font-medium',
        tone === 'emerald'
          ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20'
          : 'bg-red-500/10 text-red-300 ring-1 ring-red-500/20',
      )}
    >
      {label}
    </span>
  )
}

function InlineAction({
  to,
  icon,
  label,
}: {
  to: string
  icon: ReactNode
  label: string
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink-800/50 bg-ink-950/60 px-3.5 py-2.5 text-sm font-medium text-ink-200 transition-all hover:border-ink-700/60 hover:bg-ink-900/60 hover:text-ink-100"
    >
      {icon}
      {label}
    </Link>
  )
}

function KpiTile({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string
  note: string
  tone: 'ink' | 'accent' | 'amber' | 'emerald' | 'red'
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border px-4 py-4',
        tone === 'ink' && 'border-ink-800/60 bg-ink-950/70',
        tone === 'accent' && 'border-accent-800/40 bg-accent-950/20',
        tone === 'amber' && 'border-amber-900/40 bg-amber-950/10',
        tone === 'emerald' && 'border-emerald-900/30 bg-emerald-950/10',
        tone === 'red' && 'border-red-900/30 bg-red-950/10',
      )}
    >
      <p className="font-opsMono text-[11px] uppercase tracking-[0.22em] text-ink-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink-50">{value}</p>
      <p className="mt-1 text-xs leading-6 text-ink-500">{note}</p>
    </div>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div>
      <p className="font-opsMono text-[11px] uppercase tracking-[0.24em] text-ink-500">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink-50">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-400">{description}</p>
    </div>
  )
}

function CommandAction(_: {
  to: string
  label: string
  note: string
  icon: ReactNode
  tone: 'accent' | 'sky' | 'amber' | 'emerald' | 'ink'
}) {
  return (
    <Link
      to={_.to}
      className={clsx(
        'group rounded-xl border px-4 py-4 transition-all duration-200 hover:-translate-y-0.5',
        _.tone === 'accent' && 'border-accent-800/40 bg-accent-950/15 hover:bg-accent-950/25',
        _.tone === 'sky' && 'border-sky-900/40 bg-sky-950/10 hover:bg-sky-950/20',
        _.tone === 'amber' && 'border-amber-900/40 bg-amber-950/10 hover:bg-amber-950/20',
        _.tone === 'emerald' && 'border-emerald-900/30 bg-emerald-950/10 hover:bg-emerald-950/20',
        _.tone === 'ink' && 'border-ink-800/60 bg-ink-950/60 hover:bg-ink-950/80',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/5 bg-black/10 text-ink-200">
          {_.icon}
        </div>
        <ArrowRight className="h-4 w-4 text-ink-600 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-ink-100">{_.label}</h3>
      <p className="mt-1 text-sm leading-6 text-ink-500">{_.note}</p>
    </Link>
  )
}

function MiniStat(_: {
  label: string
  value: number
  tone: 'emerald' | 'amber' | 'red'
}) {
  return (
    <div className="rounded-xl border border-ink-800/60 bg-ink-950/65 px-4 py-3">
      <p className="font-opsMono text-[10px] uppercase tracking-[0.2em] text-ink-500">{_.label}</p>
      <p
        className={clsx(
          'mt-2 text-xl font-semibold',
          _.tone === 'emerald' && 'text-emerald-300',
          _.tone === 'amber' && 'text-amber-300',
          _.tone === 'red' && 'text-red-300',
        )}
      >
        {_.value}
      </p>
    </div>
  )
}

function TimelineRow(_: {
  job: { id: string; status: JobStatus; message: string | null; seriesId: string; startedAt: string }
}) {
  const { job } = _

  return (
    <Link
      to="/jobs"
      className="flex items-start gap-3 rounded-xl border border-ink-800/50 bg-ink-950/55 px-4 py-3 transition-colors hover:bg-ink-950/75"
    >
      <div className="mt-0.5">{JOB_META[job.status].icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={clsx('rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]', JOB_META[job.status].pill)}>
            {JOB_META[job.status].label}
          </span>
          <span className="font-opsMono text-[10px] uppercase tracking-[0.18em] text-ink-600">
            {formatTimeAgo(job.startedAt)}
          </span>
        </div>
        <p className="mt-2 truncate text-sm text-ink-200">{job.message ?? job.seriesId}</p>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-600" />
    </Link>
  )
}

function SourceHealthRow({
  entry,
}: {
  entry: SourceHealthDto
}) {
  const meta = HEALTH_META[entry.status]

  return (
    <div className="grid gap-3 rounded-xl border border-ink-800/50 bg-ink-950/55 px-4 py-3 md:grid-cols-[1.2fr_0.8fr_0.6fr]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={clsx('h-2.5 w-2.5 rounded-full', meta.dot)} />
          <span className="text-sm font-medium text-ink-100">{entry.sourceId}</span>
        </div>
        <p className="mt-1 truncate text-xs text-ink-500">{entry.error || 'Healthy response cycle'}</p>
      </div>
      <div className="flex items-center">
        <span className={clsx('rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]', meta.pill)}>
          {meta.label}
        </span>
      </div>
      <div className="flex items-center md:justify-end">
        <span className="font-opsMono text-xs uppercase tracking-[0.18em] text-ink-400">
          {formatLatency(entry.latencyMs)}
        </span>
      </div>
    </div>
  )
}

function SystemRow(_: {
  icon: ReactNode
  label: string
  value: string
  note: string
  tone: 'emerald' | 'red' | 'amber' | 'ink'
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-800/50 bg-ink-950/55 px-4 py-3">
      <div
        className={clsx(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border',
          _.tone === 'emerald' && 'border-emerald-900/30 bg-emerald-950/10 text-emerald-300',
          _.tone === 'red' && 'border-red-900/30 bg-red-950/10 text-red-300',
          _.tone === 'amber' && 'border-amber-900/30 bg-amber-950/10 text-amber-300',
          _.tone === 'ink' && 'border-ink-800/60 bg-ink-900/70 text-ink-300',
        )}
      >
        {_.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink-100">{_.label}</p>
            <p className="mt-1 text-xs text-ink-500">{_.note}</p>
          </div>
          <span className="font-opsMono text-[10px] uppercase tracking-[0.18em] text-ink-400">
            {_.value}
          </span>
        </div>
      </div>
    </div>
  )
}

function ReadoutBlock(_: {
  icon: ReactNode
  label: string
  value: string
  note: string
}) {
  return (
    <div className="rounded-xl border border-ink-800/50 bg-ink-950/55 px-4 py-4">
      <div className="flex items-center gap-2 text-ink-400">
        {_.icon}
        <span className="font-opsMono text-[10px] uppercase tracking-[0.18em]">{_.label}</span>
      </div>
      <p className="mt-3 text-lg font-semibold text-ink-100">{_.value}</p>
      <p className="mt-1 text-sm leading-6 text-ink-500">{_.note}</p>
    </div>
  )
}

function LibraryRow(_: {
  library: { id: string; name: string; roots: string[] }
}) {
  return (
    <div className="rounded-xl border border-ink-800/50 bg-ink-950/55 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-ink-800/60 bg-ink-900/70 text-ink-300">
          <Library className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-ink-100">{_.library.name}</p>
            <span className="font-opsMono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              {_.library.roots.length} root{_.library.roots.length === 1 ? '' : 's'}
            </span>
          </div>
          {_.library.roots[0] && (
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-500">
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{_.library.roots[0]}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface SparklineDay {
  label: string
  completed: number
  failed: number
}

function buildSparklineData(_: { status: JobStatus; startedAt: string }[]): SparklineDay[] {
  const days: SparklineDay[] = []
  const now = new Date()

  for (let index = 6; index >= 0; index--) {
    const day = new Date(now)
    day.setDate(day.getDate() - index)
    const key = day.toISOString().slice(0, 10)
    const label = day.toLocaleDateString(undefined, { weekday: 'short' })
    const bucket: SparklineDay = { label, completed: 0, failed: 0 }

    for (const job of _) {
      if (job.startedAt.slice(0, 10) !== key) continue
      if (job.status === 'COMPLETED') bucket.completed += 1
      if (job.status === 'FAILED') bucket.failed += 1
    }

    days.push(bucket)
  }

  return days
}

function Sparkline(_: { data: SparklineDay[] }) {
  const maxValue = Math.max(1, ..._.data.map((entry) => entry.completed + entry.failed))

  if (_.data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-ink-400">
        No recent job telemetry yet.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex h-36 items-end gap-2">
        {_.data.map((entry) => {
          const completedHeight = (entry.completed / maxValue) * 110
          const failedHeight = (entry.failed / maxValue) * 110

          return (
            <div key={entry.label} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-28 w-full flex-col justify-end gap-1">
                {failedHeight > 0 && (
                  <div className="w-full rounded-t-xl bg-red-500/75" style={{ height: `${failedHeight}px` }} />
                )}
                {completedHeight > 0 && (
                  <div className="w-full rounded-t-xl bg-emerald-500/75" style={{ height: `${completedHeight}px` }} />
                )}
              </div>
              <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-500">
                {entry.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const base = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.floor(Math.log(bytes) / Math.log(base))
  return `${parseFloat((bytes / Math.pow(base, index)).toFixed(1))} ${sizes[index]}`
}

function formatLatency(latencyMs: number | null | undefined): string {
  if (latencyMs == null) return 'pending'
  if (latencyMs >= 1000) return `${(latencyMs / 1000).toFixed(1)} s`
  return `${latencyMs} ms`
}

function formatTimeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
