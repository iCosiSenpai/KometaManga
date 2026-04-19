import { clsx } from 'clsx'
import { Eyebrow } from './Eyebrow'

export interface HairRuleProps {
  label?: string
  jp?: string
  align?: 'left' | 'center'
  className?: string
}

/**
 * Thin 1px separator with optional inline eyebrow label.
 * Draws in from left on mount for a subtle editorial feel.
 */
export function HairRule({ label, jp, align = 'left', className }: HairRuleProps) {
  if (!label) {
    return <div className={clsx('ma-rule', className)} role="separator" />
  }

  const labelPlacement =
    align === 'center'
      ? 'flex items-center justify-center gap-4'
      : 'flex items-center gap-4'

  return (
    <div className={clsx(labelPlacement, className)} role="separator" aria-label={label}>
      {align === 'center' && <div className="ma-rule flex-1" />}
      <Eyebrow jp={jp} en={label} className="shrink-0" />
      <div className="ma-rule flex-1" />
    </div>
  )
}
