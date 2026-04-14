import { useQuery } from '@tanstack/react-query'
import { api, KomfConfig } from '@/api/client'
import { useAutoSave } from '@/hooks/useAutoSave'
import { PageHeader } from '@/components/PageHeader'
import { PageSpinner } from '@/components/Spinner'
import { ErrorState } from '@/components/ErrorState'
import {
  SettingsSection,
  ToggleField,
  TagListField,
  SaveIndicator,
} from '@/components/settings/SettingsFields'

export function EventListenerSettings() {
  const configQuery = useQuery({ queryKey: ['config'], queryFn: api.getConfig })
  const librariesQuery = useQuery({
    queryKey: ['libraries'],
    queryFn: api.getLibraries,
  })

  if (configQuery.isLoading) return <PageSpinner />
  if (configQuery.isError)
    return <ErrorState message="Failed to load config" onRetry={() => configQuery.refetch()} />

  return (
    <EventListenerForm
      config={configQuery.data!}
      libraries={librariesQuery.data ?? []}
    />
  )
}

function EventListenerForm({
  config,
  libraries,
}: {
  config: KomfConfig
  libraries: { id: string; name: string }[]
}) {
  const { status, error, save, dismissError } = useAutoSave()
  const el = config.komga.eventListener
  const libSuggestions = libraries.map((l) => ({ value: l.id, label: l.name }))

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Event Listener"
        description="Control automatic metadata matching when new series are added to Komga."
      />

      <div className="space-y-6">
        <SettingsSection
          title="Event Listener"
          description="When enabled, KometaManga automatically processes new series added to filtered libraries."
          action={<SaveIndicator status={status} error={error} onDismiss={dismissError} />}
        >
          <ToggleField
            label="Enabled"
            checked={el.enabled}
            description="Automatically match metadata for new series."
            onChange={(v) =>
              save({ komga: { eventListener: { enabled: v } } }, true)
            }
          />
        </SettingsSection>

        <SettingsSection
          title="Metadata Filters"
          description="Select which libraries trigger automatic metadata matching."
        >
          <TagListField
            label="Metadata Library Filter"
            values={[...el.metadataLibraryFilter]}
            suggestions={libSuggestions}
            description="Only libraries in this list will trigger auto-matching. Empty = all libraries."
            onChange={(v) =>
              save(
                { komga: { eventListener: { metadataLibraryFilter: v } } },
                true,
              )
            }
          />

          <TagListField
            label="Exclude Series Filter"
            values={[...el.metadataSeriesExcludeFilter]}
            placeholder="Series name pattern to exclude"
            description="Series matching these patterns will be skipped during auto-matching."
            onChange={(v) =>
              save(
                { komga: { eventListener: { metadataExcludeSeriesFilter: v } } },
                true,
              )
            }
          />
        </SettingsSection>

        <SettingsSection
          title="Notification Filters"
          description="Select which libraries trigger notifications."
        >
          <TagListField
            label="Notification Library Filter"
            values={[...el.notificationsLibraryFilter]}
            suggestions={libSuggestions}
            description="Only libraries in this list will send notifications. Empty = all libraries."
            onChange={(v) =>
              save(
                { komga: { eventListener: { notificationsLibraryFilter: v } } },
                true,
              )
            }
          />
        </SettingsSection>
      </div>
    </div>
  )
}
