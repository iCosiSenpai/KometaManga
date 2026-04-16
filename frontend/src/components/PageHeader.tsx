import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-50">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-ink-400">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
