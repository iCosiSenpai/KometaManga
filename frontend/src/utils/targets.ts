import type { Library } from '@/api/client'

export function deriveTargetName(
  path: string,
  komgaLibId: string | null,
  libraries: Library[],
): string {
  if (komgaLibId) {
    const lib = libraries.find((l) => l.id === komgaLibId)
    if (lib) return lib.name
  }
  const seg = (path || '').replace(/\/+$/, '').split('/').filter(Boolean)
  return seg[seg.length - 1] || 'Download folder'
}
