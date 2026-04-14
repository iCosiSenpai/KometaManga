import { Loader2 } from 'lucide-react'

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-ink-400 ${className}`} />
}

export function PageSpinner() {
  return (
    <div className="flex h-64 items-center justify-center animate-fade-in">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="h-8 w-8" />
        <span className="text-xs text-ink-500">Loading…</span>
      </div>
    </div>
  )
}
