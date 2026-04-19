import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

export interface StatColumnProps {
  label: string
  value: number | string
  unit?: string
  accent?: boolean
  to?: string
  className?: string
}

/**
 * Large editorial stat. Numeric values animate from 0 to target once
 * (count-up, 600ms). String values render instantly. When `to` is
 * provided, the whole column becomes a link with a subtle hover
 * affordance (arrow slides, underline draws).
 */
export function StatColumn({ label, value, unit, accent, to, className }: StatColumnProps) {
  const display = useCountUp(value)

  const inner = (
    <>
      <span className="flex items-center gap-2 ma-faint font-opsMono text-[10px] uppercase tracking-[0.24em]">
        {label}
        {to && (
          <ArrowUpRight
            className="h-3 w-3 translate-y-px opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
            aria-hidden
          />
        )}
      </span>
      <span
        className={clsx(
          'mt-3 font-serif text-[64px] leading-none tracking-[-0.03em] sm:text-[76px]',
          accent ? 'ma-accent' : 'ma-text',
        )}
      >
        {display}
      </span>
      {unit && (
        <span className="mt-2 ma-muted font-sans text-sm tracking-tight">
          {unit}
        </span>
      )}
    </>
  )

  const baseClass = clsx(
    'flex flex-col items-start',
    to && 'group cursor-pointer',
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

function useCountUp(value: number | string): string {
  const [shown, setShown] = useState<number | string>(
    typeof value === 'number' ? 0 : value,
  )
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof value !== 'number') {
      setShown(value)
      return
    }
    const target = value
    const duration = 600
    const start = performance.now()
    const startVal = 0

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = Math.round(startVal + (target - startVal) * eased)
      setShown(current)
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    }
  }, [value])

  return String(shown)
}
