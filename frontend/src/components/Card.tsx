import { clsx } from 'clsx'
import type { ReactNode } from 'react'

type CardVariant = 'default' | 'accent' | 'subtle'

const variantStyles: Record<CardVariant, string> = {
  default:
    'rounded-2xl border border-ink-800/50 bg-ink-900/50 p-6 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-card-hover hover:border-ink-700/50',
  accent:
    'rounded-2xl border border-accent-800/40 bg-gradient-to-br from-ink-900/80 to-accent-950/30 p-6 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-card-hover hover:border-accent-700/50',
  subtle:
    'rounded-xl border border-ink-800/30 bg-ink-900/30 p-4 transition-all duration-200 hover:bg-ink-900/50 hover:border-ink-700/30',
}

export interface CardProps {
  children: ReactNode
  className?: string
  variant?: CardVariant
  onClick?: () => void
}

export function Card({ children, className, variant = 'default', onClick }: CardProps) {
  return (
    <div className={clsx(variantStyles[variant], className)} onClick={onClick}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between">
      <div>
        <h3 className="font-display text-lg font-semibold text-ink-100">{title}</h3>
        {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
      </div>
      {action}
    </div>
  )
}
