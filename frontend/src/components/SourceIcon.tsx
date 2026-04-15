import { useState } from 'react'
import { clsx } from 'clsx'
import { SOURCE_BRAND } from '@/lib/brand'
import type { MangaSourceId } from '@/api/sources'

const SHORT: Record<MangaSourceId, string> = {
  MANGADEX: 'MD',
  COMICK: 'CK',
  MANGAWORLD: 'MW',
  NINEMANGA: 'WC',
  MANGAPILL: 'MP',
  MANGAFIRE: 'MF',
}

const DOT_BG: Record<MangaSourceId, string> = {
  MANGADEX: 'bg-orange-500/20 text-orange-200 ring-orange-500/40',
  COMICK: 'bg-rose-500/20 text-rose-200 ring-rose-500/40',
  MANGAWORLD: 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/40',
  NINEMANGA: 'bg-cyan-500/20 text-cyan-200 ring-cyan-500/40',
  MANGAPILL: 'bg-pink-500/20 text-pink-200 ring-pink-500/40',
  MANGAFIRE: 'bg-amber-500/20 text-amber-200 ring-amber-500/40',
}

/**
 * Source icon: tries to load the site favicon, falls back to a colored
 * monogram badge if the network request fails (e.g. offline, CSP, adblock).
 */
export function SourceIcon({
  sourceId,
  size = 16,
  className,
}: {
  sourceId: MangaSourceId
  size?: number
  className?: string
}) {
  const brand = SOURCE_BRAND[sourceId]
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        style={{ width: size, height: size, fontSize: Math.max(7, size * 0.48) }}
        className={clsx(
          'inline-flex items-center justify-center rounded-[4px] font-mono font-bold ring-1',
          DOT_BG[sourceId],
          className,
        )}
        title={brand.label}
      >
        {SHORT[sourceId]}
      </span>
    )
  }

  return (
    <img
      src={brand.iconUrl}
      alt={brand.label}
      title={brand.label}
      width={size}
      height={size}
      className={clsx('inline-block rounded-sm', className)}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
