import { useQuery } from '@tanstack/react-query'
import { api, KomfConfig } from '@/api/client'
import { useAutoSave } from '@/hooks/useAutoSave'
import { PageHeader } from '@/components/PageHeader'
import { PageSpinner } from '@/components/Spinner'
import { ErrorState } from '@/components/ErrorState'
import {
  SettingsSection,
  ToggleField,
  NumberField,
  SaveIndicator,
} from '@/components/settings/SettingsFields'

export function SchedulerSettings() {
  const configQuery = useQuery({ queryKey: ['config'], queryFn: api.getConfig })

  if (configQuery.isLoading) return <PageSpinner />
  if (configQuery.isError)
    return <ErrorState message="Failed to load config" onRetry={() => configQuery.refetch()} />

  return <SchedulerForm config={configQuery.data!} />
}

function EnvManagedHint({ envName }: { envName: string }) {
  return (
    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
      Managed by environment variable: <span className="font-mono">{envName}</span>
    </p>
  )
}

function SchedulerForm({ config }: { config: KomfConfig }) {
  const { status, error, save, dismissError } = useAutoSave()
  const locks = config.envLocks
  const scheduler = config.scheduler ?? { autoMatchEnabled: false, autoMatchIntervalHours: 24 }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Scheduler"
        description="Configure auto-match scheduling for unmatched series."
      />

      <SaveIndicator status={status} error={error} onDismiss={dismissError} />

      <SettingsSection title="Auto-Match">
        {locks.schedulerAutoMatchEnabled && <EnvManagedHint envName="KOMF_SCHEDULER_AUTO_MATCH_ENABLED" />}
        <ToggleField
          label="Enable scheduled auto-match"
          description="Periodically scan all libraries and auto-match unmatched series."
          checked={scheduler.autoMatchEnabled}
          disabled={!!locks.schedulerAutoMatchEnabled}
          onChange={(v) =>
            save({ scheduler: { autoMatchEnabled: v, autoMatchIntervalHours: scheduler.autoMatchIntervalHours } })
          }
        />

        {scheduler.autoMatchEnabled && (
          <>
            {locks.schedulerAutoMatchInterval && <EnvManagedHint envName="KOMF_SCHEDULER_AUTO_MATCH_INTERVAL" />}
            <NumberField
              label="Interval (hours)"
              description="How often to run the auto-match scan."
              value={scheduler.autoMatchIntervalHours}
              min={1}
              max={168}
              disabled={!!locks.schedulerAutoMatchInterval}
              onChange={(v) =>
                save({ scheduler: { autoMatchEnabled: scheduler.autoMatchEnabled, autoMatchIntervalHours: v ?? 24 } })
              }
            />
          </>
        )}
      </SettingsSection>
    </div>
  )
}
