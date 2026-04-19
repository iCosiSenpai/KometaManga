import { clsx } from 'clsx'

export interface EyebrowProps {
  jp?: string
  en: string
  className?: string
}

export function Eyebrow({ jp, en, className }: EyebrowProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] ma-faint',
        className,
      )}
    >
      {jp && (
        <span className="font-jpSans not-italic normal-case tracking-[0.12em]" aria-hidden>
          {jp}
        </span>
      )}
      {jp && <span aria-hidden className="ma-faint">·</span>}
      <span>{en}</span>
    </span>
  )
}
