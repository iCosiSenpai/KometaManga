import { clsx } from 'clsx'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

export interface DataRowProps {
  icon?: ReactNode
  title: string
  note?: string
  value?: ReactNode
  tone?: 'default' | 'accent' | 'ok' | 'warn'
  to?: string
  className?: string
}

/**
 * Editorial list row: icon (optional), title + note on the left,
 * mono value on the right. Separated only by a bottom hair rule
 * when composed in a list. If `to` is provided the row becomes a
 * React Router link with a subtle hover affordance.
 */
export function DataRow({ icon, title, note, value, tone = 'default', to, className }: DataRowProps) {
  const iconClass = clsx(
    'flex h-7 w-7 shrink-0 items-center justify-center',
    tone === 'accent' && 'ma-accent',
    tone === 'ok' && 'ma-ok',
    tone === 'warn' && 'ma-warn',
    tone === 'default' && 'ma-faint',
  )

  const valueClass = clsx(
    'font-opsMono text-[11px] uppercase tracking-[0.14em] shrink-0',
    tone === 'accent' && 'ma-accent',
    tone === 'ok' && 'ma-ok',
    tone === 'warn' && 'ma-warn',
    tone === 'default' && 'ma-muted',
  )

  const inner = (
    <>
      {icon && (
        <div className={iconClass} aria-hidden>
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="ma-text font-sans text-[14px] leading-tight">{title}</p>
        {note && <p className="mt-0.5 ma-faint font-sans text-[12px] leading-snug truncate">{note}</p>}
      </div>
      {value != null && <span className={valueClass}>{value}</span>}
      {to && (
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 ma-faint transition-transform group-hover:translate-x-0.5 group-hover:ma-text"
          aria-hidden
        />
      )}
    </>
  )

  const baseClass = clsx(
    'flex items-center gap-4 py-3 border-b ma-hair last:border-b-0',
    to && 'group -mx-2 px-2 rounded-sm cursor-pointer transition-colors hover:bg-[var(--ma-surface)]',
    className,
  )

  if (to) {
    return (
      <Link to={to} className={baseClass}>
        {inner}
      </Link>
    )
  }

  return <div className={baseClass}>{inner}</div>
}
