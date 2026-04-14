import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

interface ErrorStateProps {
  message?: string
  hint?: string
  onRetry?: () => void
}

export function ErrorState({
  message = 'Something went wrong',
  hint = 'Check the connection and try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-amber-900/30 bg-amber-950/10 text-center animate-fade-in">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/20">
        <AlertTriangle className="h-6 w-6 text-amber-400" />
      </div>
      <div className="max-w-xs">
        <p className="font-display font-semibold text-ink-200">{message}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{hint}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
