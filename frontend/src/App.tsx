import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Layout } from '@/components/Layout'
import { PageSpinner } from '@/components/Spinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SetupWizard } from '@/components/SetupWizard'
import { LoginPage } from '@/pages/LoginPage'

const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const LibrariesPage = lazy(() => import('@/pages/LibrariesPage').then(m => ({ default: m.LibrariesPage })))
const JobsPage = lazy(() => import('@/pages/JobsPage').then(m => ({ default: m.JobsPage })))
const KomgaPage = lazy(() => import('@/pages/KomgaPage').then(m => ({ default: m.KomgaPage })))
const LogsPage = lazy(() => import('@/pages/LogsPage').then(m => ({ default: m.LogsPage })))
const SourcesPage = lazy(() => import('@/pages/SourcesPage').then(m => ({ default: m.SourcesPage })))
const DownloadsPage = lazy(() => import('@/pages/DownloadsPage').then(m => ({ default: m.DownloadsPage })))
const AutoDownloaderPage = lazy(() => import('@/pages/AutoDownloaderPage').then(m => ({ default: m.AutoDownloaderPage })))

const EventListenerSettings = lazy(() => import('@/pages/settings/EventListenerSettings').then(m => ({ default: m.EventListenerSettings })))
const ProcessingSettings = lazy(() => import('@/pages/settings/ProcessingSettings').then(m => ({ default: m.ProcessingSettings })))
const ProvidersSettings = lazy(() => import('@/pages/settings/ProvidersSettings').then(m => ({ default: m.ProvidersSettings })))
const NotificationsSettings = lazy(() => import('@/pages/settings/NotificationsSettings').then(m => ({ default: m.NotificationsSettings })))
const SchedulerSettings = lazy(() => import('@/pages/settings/SchedulerSettings').then(m => ({ default: m.SchedulerSettings })))
const SettingsOverview = lazy(() => import('@/pages/settings/SettingsOverview').then(m => ({ default: m.SettingsOverview })))
const DownloadSettings = lazy(() => import('@/pages/settings/DownloadSettings').then(m => ({ default: m.DownloadSettings })))
const SourcesSettings = lazy(() => import('@/pages/settings/SourcesSettings').then(m => ({ default: m.SourcesSettings })))
const SecuritySettings = lazy(() => import('@/pages/settings/SecuritySettings').then(m => ({ default: m.SecuritySettings })))

export default function App() {
  const [setupDismissed, setSetupDismissed] = useState(false)
  const [setupStarted, setSetupStarted] = useState(false)
  const queryClient = useQueryClient()

  const authQuery = useQuery({
    queryKey: ['auth-status'],
    queryFn: api.getAuthStatus,
    retry: false,
  })

  const configQuery = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
    retry: false,
    enabled: authQuery.isSuccess && authQuery.data.authenticated,
  })

  useEffect(() => {
    if (
      !setupStarted &&
      !setupDismissed &&
      authQuery.isSuccess &&
      !authQuery.data.authConfigured
    ) {
      setSetupStarted(true)
    }
  }, [
    setupStarted,
    setupDismissed,
    authQuery.isSuccess,
    authQuery.data?.authConfigured,
  ])

  if (authQuery.isLoading) {
    return <PageSpinner />
  }

  if (authQuery.isSuccess && authQuery.data.authConfigured && !authQuery.data.authenticated) {
    return (
      <LoginPage
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['auth-status'] })
          queryClient.invalidateQueries({ queryKey: ['connection'] })
          queryClient.invalidateQueries({ queryKey: ['config'] })
        }}
      />
    )
  }

  if (setupStarted && !setupDismissed) {
    return (
      <SetupWizard
        defaultBaseUri={configQuery.data?.komga?.baseUri ?? ''}
        onComplete={() => {
          setSetupDismissed(true)
          setSetupStarted(false)
          queryClient.invalidateQueries({ queryKey: ['auth-status'] })
          queryClient.invalidateQueries({ queryKey: ['config'] })
        }}
      />
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><DashboardPage /></Suspense></ErrorBoundary>} />
        <Route path="/sources" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><SourcesPage /></Suspense></ErrorBoundary>} />
        <Route path="/downloads" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><DownloadsPage /></Suspense></ErrorBoundary>} />
        <Route path="/auto-downloader" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><AutoDownloaderPage /></Suspense></ErrorBoundary>} />
        <Route path="/libraries" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><LibrariesPage /></Suspense></ErrorBoundary>} />
        <Route path="/jobs" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><JobsPage /></Suspense></ErrorBoundary>} />
        <Route path="/komga" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><KomgaPage /></Suspense></ErrorBoundary>} />
        <Route path="/logs" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><LogsPage /></Suspense></ErrorBoundary>} />
        <Route path="/config" element={<Navigate to="/" replace />} />
        <Route path="/settings/connection" element={<Navigate to="/komga?tab=settings" replace />} />
        <Route path="/settings" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><SettingsOverview /></Suspense></ErrorBoundary>} />
        <Route path="/settings/event-listener" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><EventListenerSettings /></Suspense></ErrorBoundary>} />
        <Route path="/settings/processing" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><ProcessingSettings /></Suspense></ErrorBoundary>} />
        <Route path="/settings/providers" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><ProvidersSettings /></Suspense></ErrorBoundary>} />
        <Route path="/settings/notifications" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><NotificationsSettings /></Suspense></ErrorBoundary>} />
        <Route path="/settings/scheduler" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><SchedulerSettings /></Suspense></ErrorBoundary>} />
        <Route path="/settings/download" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><DownloadSettings /></Suspense></ErrorBoundary>} />
        <Route path="/settings/sources" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><SourcesSettings /></Suspense></ErrorBoundary>} />
        <Route path="/settings/security" element={<ErrorBoundary><Suspense fallback={<PageSpinner />}><SecuritySettings /></Suspense></ErrorBoundary>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
