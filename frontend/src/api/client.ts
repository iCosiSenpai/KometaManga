const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const body = await res.text()
    let message: string
    try {
      const parsed = JSON.parse(body) as { message?: string }
      message = parsed.message ?? body
    } catch {
      message = body || res.statusText
    }
    // Sanitise to prevent XSS if the backend returns unsanitised HTML
    const doc = new DOMParser().parseFromString(message, 'text/html')
    message = doc.body.textContent || message
    throw new ApiError(res.status, message)
  }

  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const api = {
  // Media server
  getConnected: () =>
    request<MediaServerConnectionResponse>('/komga/media-server/connected'),
  getLibraries: () => request<Library[]>('/komga/media-server/libraries'),
  getLibrarySeries: (libraryId: string, query?: string) => {
    const qs = query ? `?query=${encodeURIComponent(query)}` : ''
    return request<KomgaSeries[]>(`/komga/media-server/libraries/${libraryId}/series${qs}`)
  },

  // Config
  getConfig: () => request<KomfConfig>('/config'),
  updateConfig: (config: KomfConfigUpdateRequest) =>
    request<void>('/config', { method: 'PATCH', body: JSON.stringify(config) }),
  validateConfig: (config: KomfConfigUpdateRequest) =>
    request<{ valid: boolean; errors: string[] }>('/config/validate', {
      method: 'POST',
      body: JSON.stringify(config),
    }),
  validateDir: (path: string) =>
    request<{ exists: boolean; writable: boolean; fileCount: number; sampleFiles: string[] }>(
      '/config/validate-dir',
      { method: 'POST', body: JSON.stringify({ path }) },
    ),
  updateMangaBakaDb: (onProgress?: (info: string, completed: number, total: number) => void) => {
    return fetch(`${BASE}/update-manga-baka-db`, { method: 'POST' }).then(async (r) => {
      if (!r.ok) throw new Error('Failed to start MangaBaka database download')
      const reader = r.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          const evt = JSON.parse(line)
          if (evt.type === 'ErrorEvent') throw new Error(evt.message || 'Download failed')
          if (evt.type === 'ProgressEvent' && onProgress) onProgress(evt.info || '', evt.completed ?? 0, evt.total ?? 0)
        }
      }
    })
  },

  // Metadata
  getProviders: (libraryId?: string) => {
    const qs = libraryId ? `?libraryId=${libraryId}` : ''
    return request<string[]>(`/komga/metadata/providers${qs}`)
  },
  searchSeries: (params: { name: string; seriesId?: string; libraryId?: string }) => {
    const qs = new URLSearchParams({ name: params.name })
    if (params.seriesId) qs.set('seriesId', params.seriesId)
    if (params.libraryId) qs.set('libraryId', params.libraryId)
    return request<SearchResult[]>(`/komga/metadata/search?${qs}`)
  },
  getSeriesCover: (params: { libraryId: string; provider: string; providerSeriesId: string }) => {
    const qs = new URLSearchParams({
      libraryId: params.libraryId,
      provider: params.provider,
      providerSeriesId: params.providerSeriesId,
    })
    return fetch(`${BASE}/komga/metadata/series-cover?${qs}`)
  },
  identifySeries: (body: IdentifyRequest) =>
    request<IdentifyResponse>('/komga/metadata/identify', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  matchLibrary: (libraryId: string) =>
    request<void>(`/komga/metadata/match/library/${libraryId}`, { method: 'POST' }),
  matchSeries: (libraryId: string, seriesId: string) =>
    request<IdentifyResponse>(`/komga/metadata/match/library/${libraryId}/series/${seriesId}`, {
      method: 'POST',
    }),
  matchBulk: (seriesIds: string[]) =>
    request<{ jobIds: string[] }>('/komga/metadata/match-bulk', {
      method: 'POST',
      body: JSON.stringify({ seriesIds }),
    }),
  resetLibrary: (libraryId: string, removeComicInfo?: boolean) =>
    request<void>(`/komga/metadata/reset/library/${libraryId}${removeComicInfo ? '?removeComicInfo=true' : ''}`, { method: 'POST' }),
  resetSeries: (libraryId: string, seriesId: string, removeComicInfo?: boolean) =>
    request<void>(`/komga/metadata/reset/library/${libraryId}/series/${seriesId}${removeComicInfo ? '?removeComicInfo=true' : ''}`, {
      method: 'POST',
    }),

  // Komga integration
  getKomgaIntegrationStatus: () =>
    request<KomgaIntegrationStatus>('/komga/metadata/integration/status'),

  // Jobs
  getJobs: (params?: { status?: JobStatus; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.pageSize != null) qs.set('pageSize', String(params.pageSize))
    const query = qs.toString()
    return request<KomfPage<MetadataJob[]>>(`/jobs${query ? `?${query}` : ''}`)
  },
  getJob: (jobId: string) => request<MetadataJob>(`/jobs/${jobId}`),
  deleteAllJobs: () => request<void>('/jobs/all', { method: 'DELETE' }),
  cancelJob: (jobId: string) => request<void>(`/jobs/${jobId}`, { method: 'DELETE' }),
  retryJob: (jobId: string) => request<{ id: string }>(`/jobs/${jobId}/retry`, { method: 'POST' }),
  getJobEvents: (jobId: string) => new EventSource(`${BASE}/jobs/${jobId}/events`),

  // Notifications - Discord
  getDiscordTemplates: () =>
    request<DiscordTemplates>('/notifications/discord/templates'),
  updateDiscordTemplates: (templates: DiscordTemplates) =>
    request<void>('/notifications/discord/templates', {
      method: 'POST',
      body: JSON.stringify(templates),
    }),
  sendDiscordTest: (body: DiscordRequest) =>
    request<void>('/notifications/discord/send', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  renderDiscord: (body: DiscordRequest) =>
    request<DiscordRenderResult>('/notifications/discord/render', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Notifications - Apprise
  getAppriseTemplates: () =>
    request<AppriseTemplates>('/notifications/apprise/templates'),
  updateAppriseTemplates: (templates: AppriseTemplates) =>
    request<void>('/notifications/apprise/templates', {
      method: 'POST',
      body: JSON.stringify(templates),
    }),
  sendAppriseTest: (body: AppriseRequest) =>
    request<void>('/notifications/apprise/send', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  renderApprise: (body: AppriseRequest) =>
    request<AppriseRenderResult>('/notifications/apprise/render', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Webhook verification
  verifyDiscordWebhook: (url: string) =>
    request<WebhookVerifyResponse>('/notifications/discord/verify', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  // Notification delivery logs
  getNotificationLogs: (limit = 50, offset = 0) =>
    request<NotificationLogsPage>(`/notifications/logs?limit=${limit}&offset=${offset}`),

  // Application logs
  getLogs: (limit = 200) =>
    request<AppLogEntry[]>(`/logs?limit=${limit}`),

  // Version / update check
  getVersion: () => request<VersionInfo>('/version'),

  // Storage stats
  getStorageStats: () => request<StorageStats>('/storage/stats'),

  // ── Auth ──
  getAuthStatus: () => request<AuthStatusResponse>('/auth/status'),
  login: (body: LoginRequest) =>
    request<AuthStatusResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  setupAuth: (body: SetupAuthRequest) =>
    request<AuthStatusResponse>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateAuth: (body: UpdateAuthRequest) =>
    request<AuthStatusResponse>('/auth/update', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // ── Manga Sources ──
  getSources: () =>
    request<import('./sources').MangaSourceDto[]>('/sources'),
  getSourcesHealth: () =>
    request<import('./sources').SourceHealthDto[]>('/sources/health'),
  refreshSourcesHealth: () =>
    request<import('./sources').SourceHealthDto[]>('/sources/health/refresh', { method: 'POST' }),
  searchSource: (sourceId: string, query: string, limit = 20, language?: string | null) =>
    request<import('./sources').MangaSearchResultDto[]>(
      `/sources/${sourceId}/search?query=${encodeURIComponent(query)}&limit=${limit}${language ? `&language=${encodeURIComponent(language)}` : ''}`,
    ),
  getMangaDetails: (sourceId: string, mangaId: string) =>
    request<import('./sources').MangaDetailsDto>(
      `/sources/${sourceId}/manga/${encodeURIComponent(mangaId)}`,
    ),
  getMangaChapters: (sourceId: string, mangaId: string, language?: string) => {
    const qs = language ? `?language=${encodeURIComponent(language)}` : ''
    return request<import('./sources').MangaChapterDto[]>(
      `/sources/${sourceId}/manga/${encodeURIComponent(mangaId)}/chapters${qs}`,
    )
  },

  // ── Downloads ──
  downloadChapters: (body: import('./sources').DownloadRequestDto) =>
    request<import('./sources').DownloadQueueItemDto[]>('/downloads', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getDownloadStatus: () =>
    request<import('./sources').DownloadStatusDto>('/downloads/status'),
  getDownloadQueue: () =>
    request<import('./sources').DownloadQueueItemDto[]>('/downloads/queue'),
  removeDownloadItem: (id: string) =>
    request<void>(`/downloads/queue/${id}`, { method: 'DELETE' }),
  clearCompletedDownloads: () =>
    request<void>('/downloads/queue/clear-completed', { method: 'POST' }),
  clearErroredDownloads: () =>
    request<void>('/downloads/queue/clear-errors', { method: 'POST' }),
  retryFailedDownloads: () =>
    request<void>('/downloads/queue/retry-failed', { method: 'POST' }),
  pauseDownloads: () =>
    request<void>('/downloads/queue/pause', { method: 'POST' }),
  resumeDownloads: () =>
    request<void>('/downloads/queue/resume', { method: 'POST' }),
  cancelAllDownloads: () =>
    request<void>('/downloads/queue/cancel-all', { method: 'POST' }),
  pauseDownloadItem: (id: string) =>
    request<void>(`/downloads/queue/${id}/pause`, { method: 'POST' }),
  resumeDownloadItem: (id: string) =>
    request<void>(`/downloads/queue/${id}/resume`, { method: 'POST' }),
  cancelDownloadItem: (id: string) =>
    request<void>(`/downloads/queue/${id}/cancel`, { method: 'POST' }),
  retryDownloadItem: (id: string) =>
    request<void>(`/downloads/queue/${id}/retry`, { method: 'POST' }),
  moveDownloadItem: (id: string, direction: import('./sources').DownloadMoveDirection) =>
    request<void>(`/downloads/queue/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ direction }),
    }),
  getDownloadHistory: (limit = 50, offset = 0) =>
    request<import('./sources').DownloadedChapterDto[]>(
      `/downloads/history?limit=${limit}&offset=${offset}`,
    ),
  getDownloadStats: () =>
    request<import('./sources').DownloadStatsDto>('/downloads/stats'),

  // ── Auto-Downloader ──
  getAutoDownloaderStatus: () =>
    request<import('./sources').AutoDownloaderStatusDto>('/auto-downloader/status'),
  autoDownloaderCheckNow: () =>
    request<void>('/auto-downloader/check-now', { method: 'POST' }),
  getAutoDownloaderRules: () =>
    request<import('./sources').AutoDownloaderRuleDto[]>('/auto-downloader/rules'),
  createAutoDownloaderRule: (body: import('./sources').CreateAutoDownloaderRuleDto) =>
    request<import('./sources').AutoDownloaderRuleDto>('/auto-downloader/rules', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateAutoDownloaderRule: (id: string, body: import('./sources').UpdateAutoDownloaderRuleDto) =>
    request<import('./sources').AutoDownloaderRuleDto>(`/auto-downloader/rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteAutoDownloaderRule: (id: string) =>
    request<void>(`/auto-downloader/rules/${id}`, { method: 'DELETE' }),
}

// ──────────────────────────────────────────────
// Types matching Kotlin API DTOs
// ──────────────────────────────────────────────

// --- Enums ---

export type KomfMediaType = 'MANGA' | 'NOVEL' | 'COMIC' | 'WEBTOON'
export type KomfNameMatchingMode = 'EXACT' | 'CLOSEST_MATCH'
export type KomfReadingDirection = 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT' | 'VERTICAL' | 'WEBTOON'
export type KomfUpdateMode = 'API' | 'COMIC_INFO'
export type KomfAuthorRole =
  | 'WRITER' | 'PENCILLER' | 'INKER' | 'COLORIST'
  | 'LETTERER' | 'COVER' | 'EDITOR' | 'TRANSLATOR'
export type MangaDexLink =
  | 'MANGA_DEX' | 'ANILIST' | 'ANIME_PLANET' | 'BOOKWALKER_JP'
  | 'MANGA_UPDATES' | 'NOVEL_UPDATES' | 'KITSU' | 'AMAZON'
  | 'EBOOK_JAPAN' | 'MY_ANIME_LIST' | 'CD_JAPAN' | 'RAW' | 'ENGLISH_TL'
export type MangaBakaMode = 'API' | 'DATABASE'
export type JobStatus = 'RUNNING' | 'FAILED' | 'COMPLETED'
export type KomfProvider =
  | 'ANILIST' | 'BANGUMI' | 'BOOK_WALKER' | 'COMIC_VINE' | 'HENTAG'
  | 'KODANSHA' | 'MAL' | 'MANGA_BAKA' | 'MANGA_UPDATES' | 'MANGADEX'
  | 'NAUTILJON' | 'WEBTOONS' | 'YEN_PRESS' | 'VIZ'

// --- Version ---

export interface VersionInfo {
  current: string
  latest: string | null
  updateAvailable: boolean
  releaseUrl: string | null
}

// --- Storage ---

export interface StorageStats {
  downloadDir: string
  totalBytes: number
  usableBytes: number
  usedBytes: number
  fileCount: number
  folderCount: number
}

// --- Media server ---

export interface MediaServerConnectionResponse {
  success: boolean
  httpStatusCode?: number
  errorMessage?: string
}

export interface Library {
  id: string
  name: string
  roots: string[]
}

export interface KomgaSeries {
  id: string
  libraryId: string
  name: string
  booksCount: number
}

// --- Config GET response ---

export interface KomfConfig {
  komga: KomgaConfig
  notifications: NotificationConfig
  metadataProviders: MetadataProvidersConfig
  scheduler?: SchedulerConfig
  download?: DownloadConfig
  autoDownloader?: AutoDownloaderConfig
  envLocks: EnvLocks
}

export interface EnvLocks {
  komgaBaseUri: boolean
  komgaUser: boolean
  komgaPassword: boolean
  serverPort: boolean
  logLevel: boolean
  discordWebhooks: boolean
  appriseUrls: boolean
  malClientId: boolean
  comicVineApiKey: boolean
  comicVineSearchLimit: boolean
  bangumiToken: boolean
  downloadDir?: boolean
  downloadCbzCompression?: boolean
  downloadConcurrentPages?: boolean
  downloadAutoScan?: boolean
  autoDownloaderEnabled?: boolean
  autoDownloaderInterval?: boolean
  schedulerAutoMatchEnabled?: boolean
  schedulerAutoMatchInterval?: boolean
}

export interface SchedulerConfig {
  autoMatchEnabled: boolean
  autoMatchIntervalHours: number
}

export interface DownloadTarget {
  id: string
  name: string
  containerPath: string
  komgaLibraryId: string | null
  komgaLibraryPath: string | null
}

export interface DownloadConfig {
  downloadDir: string
  komgaLibraryId: string | null
  komgaLibraryPath: string | null
  autoScanAfterDownload: boolean
  cbzCompression: boolean
  concurrentPageDownloads: number
  extraTargets: DownloadTarget[]
}

export interface AutoDownloaderConfig {
  enabled: boolean
  intervalHours: number
  notifyOnNewChapters: boolean
}

export interface KomgaConfig {
  baseUri: string
  komgaUser: string
  eventListener: EventListenerConfig
  metadataUpdate: MetadataUpdateConfig
}

export interface EventListenerConfig {
  enabled: boolean
  metadataLibraryFilter: string[]
  metadataSeriesExcludeFilter: string[]
  notificationsLibraryFilter: string[]
}

export interface MetadataUpdateConfig {
  default: MetadataProcessingConfig
  library: Record<string, MetadataProcessingConfig>
}

export interface MetadataProcessingConfig {
  libraryType: KomfMediaType
  aggregate: boolean
  mergeTags: boolean
  mergeGenres: boolean
  bookCovers: boolean
  seriesCovers: boolean
  overrideExistingCovers: boolean
  lockCovers: boolean
  updateModes: KomfUpdateMode[]
  postProcessing: MetadataPostProcessingConfig
}

export interface MetadataPostProcessingConfig {
  seriesTitle: boolean
  seriesTitleLanguage: string | null
  alternativeSeriesTitles: boolean | null
  alternativeSeriesTitleLanguages: string[]
  orderBooks: boolean
  readingDirectionValue: KomfReadingDirection | null
  languageValue: string | null
  fallbackToAltTitle: boolean
  scoreTagName: string | null
  originalPublisherTagName: string | null
  publisherTagNames: PublisherTagName[]
}

export interface PublisherTagName {
  tagName: string
  language: string
}

// --- Providers config ---

export interface MetadataProvidersConfig {
  malClientId: string | null
  comicVineClientId: string | null
  comicVineSearchLimit: number | null
  comicVineIssueName: string | null
  comicVineIdFormat: string | null
  nameMatchingMode: KomfNameMatchingMode
  defaultProviders: ProvidersConfig
  libraryProviders: Record<string, ProvidersConfig>
  mangaBakaDatabase: MangaBakaDatabase | null
}

export interface MangaBakaDatabase {
  downloadTimestamp: string
  checksum: string
}

export interface ProvidersConfig {
  mangaUpdates: ProviderConfig
  mal: ProviderConfig
  nautiljon: ProviderConfig
  aniList: AniListConfig
  yenPress: ProviderConfig
  kodansha: ProviderConfig
  viz: ProviderConfig
  bookWalker: ProviderConfig
  mangaDex: MangaDexConfig
  bangumi: ProviderConfig
  comicVine: ProviderConfig
  hentag: ProviderConfig
  mangaBaka: MangaBakaConfig
  webtoons: ProviderConfig
}

export interface ProviderConfig {
  priority: number
  enabled: boolean
  seriesMetadata: SeriesMetadataConfig
  bookMetadata: BookMetadataConfig
  nameMatchingMode: KomfNameMatchingMode | null
  mediaType: KomfMediaType
  authorRoles: KomfAuthorRole[]
  artistRoles: KomfAuthorRole[]
}

export interface AniListConfig extends Omit<ProviderConfig, 'bookMetadata'> {
  bookMetadata?: never
  tagsScoreThreshold: number
  tagsSizeLimit: number
}

export interface MangaDexConfig extends ProviderConfig {
  coverLanguages: string[]
  links: MangaDexLink[]
}

export interface MangaBakaConfig extends Omit<ProviderConfig, 'bookMetadata'> {
  bookMetadata?: never
  mode: MangaBakaMode
}

export interface SeriesMetadataConfig {
  status: boolean
  title: boolean
  summary: boolean
  publisher: boolean
  readingDirection: boolean
  ageRating: boolean
  language: boolean
  genres: boolean
  tags: boolean
  totalBookCount: boolean
  authors: boolean
  releaseDate: boolean
  thumbnail: boolean
  links: boolean
  books: boolean
  useOriginalPublisher: boolean
  originalPublisherTagName: string | null
  englishPublisherTagName: string | null
  frenchPublisherTagName: string | null
}

export interface BookMetadataConfig {
  title: boolean
  summary: boolean
  number: boolean
  numberSort: boolean
  releaseDate: boolean
  authors: boolean
  tags: boolean
  isbn: boolean
  links: boolean
  thumbnail: boolean
}

// --- Notifications config ---

export interface NotificationConfig {
  apprise: AppriseConfig
  discord: DiscordConfig
}

export interface DiscordConfig {
  webhooks: string[] | null
  seriesCover: boolean
}

export interface AppriseConfig {
  urls: string[] | null
  seriesCover: boolean
}

// --- Config UPDATE request (PatchValue pattern) ---
// Fields omitted from JSON = Unset (no change).
// Fields set to null = clear. Fields with value = update.

export interface KomfConfigUpdateRequest {
  komga?: KomgaConfigUpdateRequest
  notifications?: NotificationConfigUpdateRequest
  metadataProviders?: MetadataProvidersConfigUpdateRequest
  scheduler?: Partial<SchedulerConfig>
  download?: Partial<DownloadConfig>
  autoDownloader?: Partial<AutoDownloaderConfig>
}

export interface KomgaConfigUpdateRequest {
  baseUri?: string | null
  komgaUser?: string | null
  komgaPassword?: string | null
  eventListener?: EventListenerConfigUpdateRequest
  metadataUpdate?: MetadataUpdateConfigUpdateRequest
}

export interface EventListenerConfigUpdateRequest {
  enabled?: boolean
  metadataLibraryFilter?: string[]
  metadataExcludeSeriesFilter?: string[]
  notificationsLibraryFilter?: string[]
}

export interface MetadataUpdateConfigUpdateRequest {
  default?: MetadataProcessingConfigUpdateRequest
  library?: Record<string, MetadataProcessingConfigUpdateRequest | null>
}

export interface MetadataProcessingConfigUpdateRequest {
  libraryType?: KomfMediaType
  aggregate?: boolean
  mergeTags?: boolean
  mergeGenres?: boolean
  bookCovers?: boolean
  seriesCovers?: boolean
  overrideExistingCovers?: boolean
  lockCovers?: boolean
  updateModes?: KomfUpdateMode[]
  overrideComicInfo?: boolean
  postProcessing?: MetadataPostProcessingConfigUpdateRequest
}

export interface MetadataPostProcessingConfigUpdateRequest {
  seriesTitle?: boolean
  seriesTitleLanguage?: string | null
  alternativeSeriesTitles?: boolean
  alternativeSeriesTitleLanguages?: string[]
  fallbackToAltTitle?: boolean
  orderBooks?: boolean
  readingDirectionValue?: KomfReadingDirection | null
  languageValue?: string | null
  scoreTagName?: string | null
  originalPublisherTagName?: string | null
  publisherTagNames?: PublisherTagName[]
}

export interface MetadataProvidersConfigUpdateRequest {
  comicVineClientId?: string | null
  comicVineSearchLimit?: number | null
  comicVineIssueName?: string | null
  comicVineIdFormat?: string | null
  malClientId?: string | null
  nameMatchingMode?: KomfNameMatchingMode
  defaultProviders?: ProvidersConfigUpdateRequest
  libraryProviders?: Record<string, ProvidersConfigUpdateRequest | null>
}

export interface ProvidersConfigUpdateRequest {
  mangaUpdates?: ProviderConfigUpdateRequest
  mal?: ProviderConfigUpdateRequest
  nautiljon?: ProviderConfigUpdateRequest
  aniList?: AniListConfigUpdateRequest
  yenPress?: ProviderConfigUpdateRequest
  kodansha?: ProviderConfigUpdateRequest
  viz?: ProviderConfigUpdateRequest
  bookWalker?: ProviderConfigUpdateRequest
  mangaDex?: MangaDexConfigUpdateRequest
  bangumi?: ProviderConfigUpdateRequest
  comicVine?: ProviderConfigUpdateRequest
  hentag?: ProviderConfigUpdateRequest
  mangaBaka?: MangaBakaConfigUpdateRequest
  webtoons?: ProviderConfigUpdateRequest
}

export interface ProviderConfigUpdateRequest {
  priority?: number
  enabled?: boolean
  seriesMetadata?: Partial<SeriesMetadataConfig>
  bookMetadata?: Partial<BookMetadataConfig>
  nameMatchingMode?: KomfNameMatchingMode | null
  mediaType?: KomfMediaType
  authorRoles?: KomfAuthorRole[]
  artistRoles?: KomfAuthorRole[]
}

export interface AniListConfigUpdateRequest extends ProviderConfigUpdateRequest {
  tagsScoreThreshold?: number
  tagsSizeLimit?: number
}

export interface MangaDexConfigUpdateRequest extends ProviderConfigUpdateRequest {
  coverLanguages?: string[]
  links?: MangaDexLink[]
}

export interface MangaBakaConfigUpdateRequest extends Omit<ProviderConfigUpdateRequest, 'bookMetadata'> {
  mode?: MangaBakaMode
}

export interface NotificationConfigUpdateRequest {
  apprise?: AppriseConfigUpdateRequest
  discord?: DiscordConfigUpdateRequest
}

export interface DiscordConfigUpdateRequest {
  webhooks?: Record<number, string | null>
  seriesCover?: boolean
}

export interface AppriseConfigUpdateRequest {
  urls?: Record<number, string | null>
  seriesCover?: boolean
}

// --- Metadata / Search ---

export interface SearchResult {
  url: string | null
  imageUrl: string | null
  title: string
  provider: KomfProvider
  resultId: string
}

export interface IdentifyRequest {
  libraryId: string | null
  seriesId: string
  provider: KomfProvider
  providerSeriesId: string
}

export interface IdentifyResponse {
  jobId: string
}

export interface KomgaIntegrationStatus {
  connected: boolean
  baseUri: string
  errorMessage?: string
}

// --- Jobs ---

export interface KomfPage<T> {
  content: T
  totalPages: number
  currentPage: number
}

export interface MetadataJob {
  seriesId: string
  id: string
  status: JobStatus
  message: string | null
  startedAt: string
  finishedAt: string | null
}

// --- Application logs ---

export interface AppLogEntry {
  timestamp: number
  level: string
  logger: string
  message: string
  thread: string
}

// --- Notification templates ---

export interface DiscordTemplates {
  titleTemplate: string | null
  titleUrlTemplate: string | null
  descriptionTemplate: string | null
  fields: EmbedFieldTemplate[]
  footerTemplate: string | null
}

export interface EmbedFieldTemplate {
  nameTemplate: string
  valueTemplate: string
  inline: boolean
}

export interface DiscordRequest {
  context?: NotificationContext
  templates: DiscordTemplates
}

export interface DiscordRenderResult {
  title: string | null
  titleUrl: string | null
  description: string | null
  fields: { name: string; value: string; inline: boolean }[]
  footer: string | null
}

export interface AppriseTemplates {
  titleTemplate: string | null
  bodyTemplate: string | null
}

export interface AppriseRequest {
  context?: NotificationContext
  templates: AppriseTemplates
}

export interface AppriseRenderResult {
  title: string | null
  body: string
}

export interface NotificationContext {
  library?: { id: string; name: string }
  series?: {
    id: string
    name: string
    bookCount: number
    metadata: Record<string, unknown>
  }
  books?: { id: string; name: string; number: number; metadata: Record<string, unknown> }[]
  mediaServer?: string
}

export interface WebhookVerifyResponse {
  valid: boolean
  name?: string | null
  error?: string | null
}

export interface NotificationLogEntry {
  id: number
  jobId: string | null
  channel: string
  url: string
  status: string
  errorMessage: string | null
  sentAt: number
}

export interface NotificationLogsPage {
  logs: NotificationLogEntry[]
  totalCount: number
}

// ── Helpers ──
export function imageProxyUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return `${BASE}/image-proxy?url=${encodeURIComponent(url)}`
}

// ── Auth ──

export interface AuthStatusResponse {
  authConfigured: boolean
  authenticated: boolean
  username?: string | null
}

export interface LoginRequest {
  username: string
  password: string
}

export interface SetupAuthRequest {
  username: string
  password: string
}

export interface UpdateAuthRequest {
  currentPassword?: string
  newUsername?: string
  newPassword?: string
}
