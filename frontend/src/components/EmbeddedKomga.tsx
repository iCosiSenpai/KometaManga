import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { PageSpinner } from '@/components/Spinner'
import { ErrorState } from '@/components/ErrorState'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

export function EmbeddedKomga() {
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const statusQuery = useQuery({
    queryKey: ['komga-integration-status'],
    queryFn: api.getKomgaIntegrationStatus,
  })

  if (statusQuery.isLoading) return <PageSpinner />

  if (statusQuery.isError || !statusQuery.data?.connected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <ErrorState
          message="Unable to connect to Komga"
          hint={statusQuery.data?.errorMessage || 'Check your Komga connection settings.'}
          onRetry={() => statusQuery.refetch()}
        />
      </div>
    )
  }

  if (!statusQuery.data?.baseUri) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="flex h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-amber-900/30 bg-amber-950/10 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
          </div>
          <div className="max-w-xs">
            <p className="font-display font-semibold text-ink-200">No Komga URI Configured</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
              Configure your Komga connection in the settings.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-ink-950">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-ink-800/50 bg-ink-950/90 px-3 backdrop-blur-sm">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-400 transition-colors hover:bg-ink-800/50 hover:text-ink-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          KometaManga
        </button>

        <div className="h-4 w-px bg-ink-800/50" />
        <span className="text-xs text-ink-500">Komga</span>
      </div>
      <iframe
        ref={iframeRef}
        src="/komga-proxy/"
        title="Komga"
        className="w-full flex-1 border-none"
      />
    </div>
  )
}

