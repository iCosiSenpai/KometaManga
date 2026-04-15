import { clsx } from 'clsx'
import { SOURCE_BRAND } from '@/lib/brand'
import type { MangaSourceId } from '@/api/sources'

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
  return (
    <img
      src={brand.iconUrl}
      alt={brand.label}
      title={brand.label}
      width={size}
      height={size}
      className={clsx('inline-block rounded-sm', className)}
      loading="lazy"
      onError={(e) => {
        // fallback: hide image if favicon fails
        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}
