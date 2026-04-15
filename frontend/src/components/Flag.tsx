import { clsx } from 'clsx'
import { langToCountryCode, langLabel } from '@/lib/brand'

/**
 * Renders a country flag via locally-bundled flag-icons CSS (no network).
 * Falls back to a 2-letter monospace code when the language isn't mapped.
 */
export function Flag({ code, className }: { code: string; className?: string }) {
  const cc = langToCountryCode(code)
  const label = langLabel(code)
  if (!cc) {
    return (
      <span
        className={clsx(
          'inline-block w-5 text-center font-mono text-[9px] uppercase text-ink-400',
          className,
        )}
        title={label}
      >
        {code.slice(0, 2)}
      </span>
    )
  }
  return (
    <span
      className={clsx('fi', `fi-${cc}`, 'inline-block h-3 w-4 rounded-[1px] shadow-sm', className)}
      title={label}
      role="img"
      aria-label={label}
    />
  )
}
