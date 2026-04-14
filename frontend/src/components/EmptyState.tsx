import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-ink-800/50 bg-ink-900/20 text-center animate-fade-in">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-800/40 text-ink-500">
          {icon}
        </div>
      )}
      <div className="max-w-xs">
        <p className="font-display font-semibold text-ink-300">{title}</p>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}
