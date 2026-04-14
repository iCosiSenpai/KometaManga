import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { MangaSourceId, MangaSourceDto, SourceHealthDto } from '@/api/sources'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Skeleton } from '@/components/Skeleton'
import {
  Globe,
  RefreshCw,
  ArrowLeft,
  BookOpen,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Link } from 'react-router-dom'

export function SourcesSettings() {
  const queryClient = useQueryClient()

  const sourcesQuery = useQuery({
    queryKey: ['manga-sources'],
    queryFn: api.getSources,
  })

  const healthQuery = useQuery({
    queryKey: ['manga-sources-health'],
    queryFn: api.getSourcesHealth,
    refetchInterval: 60_000,
  })

  const refreshMutation = useMutation({
    mutationFn: api.refreshSourcesHealth,
    onSuccess: (data) => {
      queryClient.setQueryData(['manga-sources-health'], data)
    },
  })

  const sources = sourcesQuery.data ?? []
  const healthMap = new Map<MangaSourceId, SourceHealthDto>()
  for (const h of healthQuery.data ?? []) {
    healthMap.set(h.sourceId, h)
  }

  return (
    <div className="animate-page-in">
      <Link
        to="/settings"
        className="mb-4 flex items-center gap-2 text-sm text-ink-400 transition-colors hover:text-ink-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Settings
      </Link>
      <PageHeader
        title="Manga Sources"
        description="Configure manga source providers and check their health status"
        action={
          <div className="flex items-center gap-2">
            <Link to="/sources">
              <Button variant="secondary" size="sm">
                <BookOpen className="h-3.5 w-3.5" />
                Browse
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              loading={refreshMutation.isPending}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Health
            </Button>
          </div>
        }
      />

      {sourcesQuery.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {sources.length > 0 && (
        <div className="space-y-3">
          {sources.map((source) => {
            const health = healthMap.get(source.sourceId)
            return (
              <SourceSettingCard
                key={source.sourceId}
                source={source}
                health={health}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function SourceSettingCard({
  source,
  health,
}: {
  source: MangaSourceDto
  health?: SourceHealthDto
}) {
  return (
    <Card variant="subtle">
      <div className="flex items-center gap-4">
        {/* Health dot */}
        <div
          className={clsx(
            'h-3 w-3 shrink-0 rounded-full',
            health?.status === 'GREEN' && 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]',
            health?.status === 'YELLOW' && 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]',
            health?.status === 'RED' && 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]',
            !health && 'bg-ink-600',
          )}
        />

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-ink-100">{source.name}</span>
            <span className="rounded bg-ink-800/60 px-1.5 py-0.5 text-[10px] font-medium uppercase text-ink-500">
              {source.sourceId}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-400">
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {source.languages.join(', ').toUpperCase()}
            </span>
            {health?.latencyMs != null && (
              <span
                className={clsx(
                  health.latencyMs > 5000 ? 'text-amber-400' : 'text-ink-500',
                )}
              >
                {health.latencyMs}ms
              </span>
            )}
            {health?.error && (
              <span className="text-red-400">{health.error}</span>
            )}
            {health?.checkedAt && (
              <span className="text-ink-500">
                Checked: {new Date(health.checkedAt).toLocaleTimeString()}
              </span>
            )}
            {!health && (
              <span className="text-ink-500 italic">Never checked</span>
            )}
          </div>
        </div>

        {/* Status label */}
        <span
          className={clsx(
            'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
            source.enabled
              ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
              : 'bg-ink-800/40 text-ink-500 ring-1 ring-ink-700/30',
          )}
        >
          {source.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
    </Card>
  )
}
