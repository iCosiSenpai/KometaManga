import type { MangaSourceId } from '@/api/sources'

// ISO 639-1 language → ISO 3166-1 country code (lowercase) for flagcdn.com
const LANG_TO_CC: Record<string, string> = {
  en: 'gb',
  it: 'it',
  ja: 'jp',
  ko: 'kr',
  zh: 'cn',
  'zh-hk': 'hk',
  fr: 'fr',
  es: 'es',
  'es-la': 'mx',
  de: 'de',
  pt: 'pt',
  'pt-br': 'br',
  ru: 'ru',
  ar: 'sa',
  th: 'th',
  vi: 'vn',
  id: 'id',
  pl: 'pl',
  tr: 'tr',
}

export const LANG_LABELS: Record<string, string> = {
  en: 'English',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  'zh-hk': 'Chinese HK',
  fr: 'French',
  es: 'Spanish',
  'es-la': 'Spanish LATAM',
  de: 'German',
  pt: 'Portuguese',
  'pt-br': 'Portuguese BR',
  ru: 'Russian',
  ar: 'Arabic',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  pl: 'Polish',
  tr: 'Turkish',
}

export function langToCountryCode(langCode: string): string | null {
  return LANG_TO_CC[langCode.toLowerCase()] ?? null
}

export function langLabel(langCode: string): string {
  return LANG_LABELS[langCode.toLowerCase()] ?? langCode.toUpperCase()
}

// Source branding: label, blurb, site URL, and favicon (via Google's S2 favicon service)
export interface SourceBrand {
  label: string
  blurb: string
  siteUrl: string
  mangaBaseUrl: string
  iconUrl: string
  accentText: string
  accentSoft: string
  accentGlow: string
  accentRing: string
}

export const SOURCE_BRAND: Record<MangaSourceId, SourceBrand> = {
  MANGADEX: {
    label: 'MangaDex',
    blurb: 'Open catalog, clean metadata, reliable for deep discovery.',
    siteUrl: 'https://mangadex.org',
    mangaBaseUrl: 'https://mangadex.org/title/',
    iconUrl: '/sources/mangadex.png',
    accentText: 'text-orange-300',
    accentSoft: 'bg-orange-500/10 text-orange-200',
    accentGlow: 'from-orange-500/18 via-orange-500/5 to-transparent',
    accentRing: 'ring-orange-500/20 border-orange-500/20',
  },
  COMICK: {
    label: 'Comick',
    blurb: 'Fast mirrors, broad catalog, strong scanlator variety.',
    siteUrl: 'https://comick.io',
    mangaBaseUrl: 'https://comick.io/comic/',
    iconUrl: '/sources/comick.png',
    accentText: 'text-rose-300',
    accentSoft: 'bg-rose-500/10 text-rose-200',
    accentGlow: 'from-rose-500/18 via-rose-500/5 to-transparent',
    accentRing: 'ring-rose-500/20 border-rose-500/20',
  },
  MANGAWORLD: {
    label: 'MangaWorld',
    blurb: 'Italian-first comfort zone with dependable browsing rhythm.',
    siteUrl: 'https://www.mangaworld.ac',
    mangaBaseUrl: 'https://www.mangaworld.ac/manga/',
    iconUrl: '/sources/mangaworld.png',
    accentText: 'text-emerald-300',
    accentSoft: 'bg-emerald-500/10 text-emerald-200',
    accentGlow: 'from-emerald-500/18 via-emerald-500/5 to-transparent',
    accentRing: 'ring-emerald-500/20 border-emerald-500/20',
  },
  NINEMANGA: {
    label: 'WeebCentral',
    blurb: 'Mirror-heavy fallback lane for broad chapter availability.',
    siteUrl: 'https://weebcentral.com',
    mangaBaseUrl: 'https://weebcentral.com/series/',
    iconUrl: '/sources/weebcentral.png',
    accentText: 'text-cyan-300',
    accentSoft: 'bg-cyan-500/10 text-cyan-200',
    accentGlow: 'from-cyan-500/18 via-cyan-500/5 to-transparent',
    accentRing: 'ring-cyan-500/20 border-cyan-500/20',
  },
  MANGAPILL: {
    label: 'Mangapill',
    blurb: 'Direct and fast. Great when you want clean no-nonsense reads.',
    siteUrl: 'https://mangapill.com',
    mangaBaseUrl: 'https://mangapill.com/manga/',
    iconUrl: '/sources/mangapill.png',
    accentText: 'text-pink-300',
    accentSoft: 'bg-pink-500/10 text-pink-200',
    accentGlow: 'from-pink-500/18 via-pink-500/5 to-transparent',
    accentRing: 'ring-pink-500/20 border-pink-500/20',
  },
  MANGAFIRE: {
    label: 'MangaFire',
    blurb: 'Polished covers, broad genres, good visual browsing cadence.',
    siteUrl: 'https://mangafire.to',
    mangaBaseUrl: 'https://mangafire.to/manga/',
    iconUrl: '/sources/mangafire.png',
    accentText: 'text-amber-300',
    accentSoft: 'bg-amber-500/10 text-amber-200',
    accentGlow: 'from-amber-500/18 via-amber-500/5 to-transparent',
    accentRing: 'ring-amber-500/20 border-amber-500/20',
  },
}
