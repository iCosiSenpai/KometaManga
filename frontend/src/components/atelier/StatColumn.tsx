import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'

export interface StatColumnProps {
  label: string
  value: number | string
  unit?: string
  accent?: boolean
  className?: string
}

/**
 * Large editorial stat. Numeric values animate from 0 to target once
 * (count-up, 600ms). String values render instantly.
 */
export function StatColumn({ label, value, unit, accent, className }: StatColumnProps) {
  const display = useCountUp(value)

  return (
    <div className={clsx('flex flex-col items-start', className)}>
      <span className="ma-faint font-opsMono text-[10px] uppercase tracking-[0.24em]">
        {label}
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
    </div>
  )
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
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
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
