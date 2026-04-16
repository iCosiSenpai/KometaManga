// ──────────────────────────────────────────────
// Types matching Kotlin manga source / download API DTOs
// ──────────────────────────────────────────────

export type MangaSourceId =
  | 'MANGADEX'
  | 'COMICK'
  | 'MANGAWORLD'
  | 'NINEMANGA'
  | 'MANGAPILL'
  | 'MANGAFIRE'

export type MangaStatus = 'ONGOING' | 'COMPLETED' | 'HIATUS' | 'CANCELLED' | 'UNKNOWN'

export type HealthStatus = 'GREEN' | 'YELLOW' | 'RED'

export type DownloadItemStatus =
  | 'QUEUED'
  | 'DOWNLOADING'
  | 'PACKAGING'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'ERROR'

// --- Sources ---

export interface MangaSourceDto {
  sourceId: MangaSourceId
  name: string
  languages: string[]
  enabled: boolean
}

export interface MangaSearchResultDto {
  id: string
  title: string
  alternativeTitles: string[]
  coverUrl: string | null
  year: number | null
  status: MangaStatus | null
  sourceId: MangaSourceId
}

export interface MangaDetailsDto {
  id: string
  title: string
  alternativeTitles: string[]
  description: string | null
  coverUrl: string | null
  authors: string[]
  artists: string[]
  genres: string[]
  tags: string[]
  status: MangaStatus | null
  year: number | null
  sourceId: MangaSourceId
}

export interface MangaChapterDto {
  id: string
  mangaId: string
  title: string | null
  chapterNumber: string
  volumeNumber: string | null
  language: string | null
  scanlator: string | null
  updatedAt: string | null
  pageCount: number | null
  sourceId: MangaSourceId
}

export interface SourceHealthDto {
  sourceId: MangaSourceId
  status: HealthStatus
  latencyMs: number | null
  error: string | null
  checkedAt: string | null
}

// --- Downloads ---

export interface DownloadRequestDto {
  sourceId: MangaSourceId
  mangaId: string
  chapterIds: string[]
  libraryPath?: string | null
  libraryId?: string | null
}

export interface DownloadQueueItemDto {
  id: string
  sourceId: MangaSourceId
  mangaId: string
  mangaTitle: string
  chapterId: string
  chapterNumber: string
  status: DownloadItemStatus
  progress: number | null
  totalPages: number | null
  error: string | null
}

export interface DownloadStatusDto {
  queueSize: number
  activeDownloads: number
  completedToday: number
  failedCount: number
  paused: boolean
}

export interface DownloadedChapterDto {
  id: string
  sourceId: MangaSourceId
  mangaId: string
  mangaTitle: string
  chapterId: string
  chapterNumber: string
  volumeNumber: string | null
  language: string | null
  filePath: string
  fileSize: number
  pageCount: number
  downloadedAt: string
}

export interface DownloadStatsDto {
  totalChapters: number
  totalSizeBytes: number
}

// --- Auto-Downloader ---

export interface AutoDownloaderRuleDto {
  id: string
  sourceId: MangaSourceId
  mangaId: string
  mangaTitle: string
  language: string | null
  scanlator: string | null
  lastChapterNumber: number | null
  enabled: boolean
  komgaLibraryId: string | null
  komgaLibraryPath: string | null
}

export interface AutoDownloaderStatusDto {
  enabled: boolean
  lastCheck: string | null
  nextCheck: string | null
  activeRulesCount: number
}

export interface CreateAutoDownloaderRuleDto {
  sourceId: MangaSourceId
  mangaId: string
  mangaTitle: string
  language?: string | null
  scanlator?: string | null
  lastChapterNumber?: number | null
  enabled?: boolean
  komgaLibraryId?: string | null
  komgaLibraryPath?: string | null
}

export interface UpdateAutoDownloaderRuleDto {
  language?: string | null
  scanlator?: string | null
  lastChapterNumber?: number | null
  enabled?: boolean
  komgaLibraryId?: string | null
  komgaLibraryPath?: string | null
}

// --- SSE Download Events ---

export type DownloadEvent =
  | { type: 'QueuedEvent'; chapterId: string; mangaTitle: string; chapterNumber: string }
  | { type: 'DownloadStartedEvent'; chapterId: string; totalPages: number }
  | { type: 'PageDownloadedEvent'; chapterId: string; currentPage: number; totalPages: number }
  | { type: 'PackagingEvent'; chapterId: string }
  | { type: 'CompletedEvent'; chapterId: string; filePath: string; fileSize: number }
  | { type: 'ErrorEvent'; chapterId: string; errorMessage: string }
  | { type: 'QueueProgressEvent'; completedCount: number; totalCount: number }
