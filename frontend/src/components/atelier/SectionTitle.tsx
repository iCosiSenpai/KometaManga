import { clsx } from 'clsx'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

export interface SectionTitleProps {
  title: string
  jp?: string
  size?: 'lg' | 'md'
  action?: { label: string; to: string }
  right?: ReactNode
  className?: string
}

/**
 * Prominent section header with optional katakana eyebrow, serif italic title,
 * optional action link on the right, and a hair rule below. Used to separate
 * major blocks on editorial pages so the user never loses orientation.
 */
export function SectionTitle({ title, jp, size = 'lg', action, right, className }: SectionTitleProps) {
  const titleSize = size === 'lg'
    ? 'text-[30px] sm:text-[34px]'
    : 'text-[22px] sm:text-[24px]'

  return (
    <div className={clsx('mb-5', className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {jp && (
            <span
              className="mb-1 block font-jpSans text-[11px] tracking-[0.14em] ma-faint"
              aria-hidden
            >
              {jp}
            </span>
          )}
          <h2
            className={clsx(
              'font-serif italic leading-none tracking-[-0.01em] ma-text',
              titleSize,
            )}
          >
            {title}
          </h2>
        </div>
        {action && (
          <Link
            to={action.to}
            className="group inline-flex shrink-0 items-center gap-1 font-opsMono text-[11px] uppercase tracking-[0.2em] ma-muted transition-colors hover:ma-text"
          >
            {action.label}
            <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
        {!action && right}
      </div>
      <div className="mt-3 ma-rule" role="separator" />
    </div>
  )
}
