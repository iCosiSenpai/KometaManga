import { clsx } from 'clsx'
import { flagUrl, langLabel } from '@/lib/brand'

export function Flag({ code, className }: { code: string; className?: string }) {
  const url = flagUrl(code)
  const label = langLabel(code)
  if (!url) {
    return (
      <span className={clsx('font-mono text-[10px] uppercase', className)} title={label}>
        {code.slice(0, 2)}
      </span>
    )
  }
  return (
    <img
      src={url}
      alt={label}
      title={label}
      className={clsx('inline-block h-3 w-auto rounded-sm shadow-sm', className)}
      loading="lazy"
    />
  )
}
