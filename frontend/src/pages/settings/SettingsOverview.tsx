import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/Card'
import { PageSpinner } from '@/components/Spinner'
import { ErrorState } from '@/components/ErrorState'
import {
  Radio,
  SlidersHorizontal,
  Layers,
  Bell,
  Tv2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  CalendarClock,
  Download,
  Globe,
  Shield,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'

const sections = [
  {
    to: '/komga?tab=settings',
    icon: Tv2,
    label: 'Komga Connection',
    description: 'Server URL and credentials for your Komga instance.',
    statusKey: 'connection' as const,
  },
  {
    to: '/settings/providers',
    icon: Layers,
    label: 'Providers',
    description: 'Configure metadata sources: AniList, MangaUpdates, MAL and more.',
    statusKey: null,
  },
  {
    to: '/settings/processing',
    icon: SlidersHorizontal,
    label: 'Processing',
    description: 'Library type, covers, update modes, aggregation and post-processing.',
    statusKey: null,
  },
  {
    to: '/settings/event-listener',
    icon: Radio,
    label: 'Event Listener',
    description: 'Automatic metadata matching when new series or books are added.',
    statusKey: 'eventListener' as const,
  },
  {
    to: '/settings/scheduler',
    icon: CalendarClock,
    label: 'Scheduler',
    description: 'Scheduled auto-match for unmatched series across libraries.',
    statusKey: 'scheduler' as const,
  },
  {
    to: '/settings/download',
    icon: Download,
    label: 'Download',
    description: 'Download directory, CBZ packaging and Komga import settings.',
    statusKey: null,
  },
  {
    to: '/settings/notifications',
    icon: Bell,
    label: 'Notifications',
    description: 'Discord, Telegram and Apprise notification channels.',
    statusKey: 'notifications' as const,
  },
  {
    to: '/settings/sources',
    icon: Globe,
    label: 'Sources Health',
    description: 'Manga source providers status, latency and availability.',
    statusKey: null,
  },
  {
    to: '/settings/security',
    icon: Shield,
    label: 'Security',
    description: 'Login credentials, password management and session settings.',
    statusKey: 'auth' as const,
  },
]

export function SettingsOverview() {
  const connectionQuery = useQuery({
    queryKey: ['connection'],
    queryFn: api.getConnected,
  })

  const configQuery = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
  })

  const authQuery = useQuery({
    queryKey: ['auth-status'],
    queryFn: api.getAuthStatus,
  })

  if (connectionQuery.isLoading || configQuery.isLoading) return <PageSpinner />
  if (connectionQuery.isError)
    return <ErrorState message="Cannot reach backend" onRetry={() => connectionQuery.refetch()} />

  const connected = connectionQuery.data?.success ?? false
  const config = configQuery.data

  function getStatus(key: (typeof sections)[number]['statusKey']) {
    if (!key) return null
    if (key === 'connection') return connected
    if (key === 'eventListener') return config?.komga.eventListener.enabled ?? false
    if (key === 'notifications') {
      const n = config?.notifications
      if (!n) return false
      return !!((n.discord?.webhooks?.length) || (n.apprise?.urls?.length))
    }
    if (key === 'scheduler') return config?.scheduler?.autoMatchEnabled ?? false
    if (key === 'auth') return authQuery.data?.authConfigured ?? false
    return null
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Settings"
        description="Configure KometaManga — connection, metadata processing, providers, and notifications."
      />

      <div className="space-y-3">
        {sections.map(({ to, icon: Icon, label, description, statusKey }) => {
          const status = getStatus(statusKey)
          return (
            <Link key={to} to={to} className="block group">
              <Card>
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-600/10 transition-colors group-hover:bg-accent-600/20">
                    <Icon className="h-5 w-5 text-accent-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink-100 group-hover:text-accent-400 transition-colors">
                        {label}
                      </h3>
                      {status !== null && (
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                            status
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-ink-800/50 text-ink-500',
                          )}
                        >
                          {status ? (
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          ) : (
                            <XCircle className="h-2.5 w-2.5" />
                          )}
                          {status ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">{description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-600 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-400" />
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
