import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export interface DataRowProps {
  icon?: ReactNode
  title: string
  note?: string
  value?: ReactNode
  tone?: 'default' | 'accent'
  className?: string
}

/**
 * Editorial list row: icon (optional), title + note on the left,
 * mono value on the right. Separated only by a bottom hair rule
 * when composed in a list.
 */
export function DataRow({ icon, title, note, value, tone = 'default', className }: DataRowProps) {
  return (
    <div
      className={clsx(
        'flex items-center gap-4 py-3 border-b',
        'ma-hair last:border-b-0',
        className,
      )}
    >
      {icon && (
        <div
          className={clsx(
            'flex h-7 w-7 shrink-0 items-center justify-center',
            tone === 'accent' ? 'ma-accent' : 'ma-faint',
          )}
          aria-hidden
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="ma-text font-sans text-[14px] leading-tight">{title}</p>
        {note && <p className="mt-0.5 ma-faint font-sans text-[12px] leading-snug truncate">{note}</p>}
      </div>
      {value != null && (
        <span
          className={clsx(
            'font-opsMono text-[11px] uppercase tracking-[0.14em] shrink-0',
            tone === 'accent' ? 'ma-accent' : 'ma-muted',
          )}
        >
          {value}
        </span>
      )}
    </div>
  )
}
