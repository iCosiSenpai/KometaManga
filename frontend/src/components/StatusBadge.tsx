import { clsx } from 'clsx'

interface StatusBadgeProps {
  status: 'connected' | 'disconnected' | 'loading'
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      role="status"
      aria-label={`Connection status: ${label ?? status}`}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        status === 'connected' && 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
        status === 'disconnected' && 'bg-red-500/10 text-red-400 ring-red-500/20',
        status === 'loading' && 'bg-ink-500/10 text-ink-400 ring-ink-500/20',
      )}
    >
      <span
        className={clsx(
          'h-1.5 w-1.5 rounded-full',
          status === 'connected' && 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.4)]',
          status === 'disconnected' && 'bg-red-400',
          status === 'loading' && 'animate-pulse-subtle bg-ink-400',
        )}
      />
      {label ?? status}
    </span>
  )
}
