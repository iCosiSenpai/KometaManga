import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export interface HeroTitleProps {
  children: ReactNode
  className?: string
  as?: 'h1' | 'h2'
}

export function HeroTitle({ children, className, as = 'h1' }: HeroTitleProps) {
  const Tag = as
  return (
    <Tag
      className={clsx(
        'font-serif italic text-[44px] leading-[1.02] tracking-[-0.02em] ma-text sm:text-[56px] md:text-[64px]',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
