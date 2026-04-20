package snd.komf.mediaserver

import app.cash.sqldelight.ColumnAdapter
import app.cash.sqldelight.EnumColumnAdapter
import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import io.ktor.client.HttpClient
import io.ktor.client.plugins.cookies.AcceptAllCookiesStorage
import io.ktor.http.URLBuilder
import io.ktor.http.appendPathSegments
import kotlinx.serialization.json.Json
import snd.komf.comicinfo.ComicInfoWriter
import snd.komf.ktor.komfUserAgent
import snd.komf.mediaserver.config.DatabaseConfig
import snd.komf.mediaserver.config.KomgaConfig
import snd.komf.mediaserver.config.MetadataProcessingConfig
import snd.komf.mediaserver.config.MetadataUpdateConfig
import snd.komf.mediaserver.download.AutoDownloaderConfig
import snd.komf.mediaserver.download.ChapterDownloader
import snd.komf.mediaserver.download.DownloadConfig
import snd.komf.mediaserver.download.DownloadItemId
import snd.komf.mediaserver.download.DownloadItemStatus
import snd.komf.mediaserver.download.DownloadQueueManager
import snd.komf.mediaserver.download.DownloadQueueRepository
import snd.komf.mediaserver.download.DownloadService
import snd.komf.mediaserver.download.DownloadedChapterId
import snd.komf.mediaserver.download.DownloadedChaptersRepository
import snd.komf.mediaserver.download.KomgaImporter
import snd.komf.mediaserver.download.auto.AutoDownloaderRuleId
import snd.komf.mediaserver.download.auto.AutoDownloaderRuleRepository
import snd.komf.mediaserver.download.auto.AutoDownloaderService
import snd.komf.mediaserver.jobs.KomfJobTracker
import snd.komf.mediaserver.jobs.KomfJobsRepository
import snd.komf.mediaserver.jobs.MetadataJobId
import snd.komf.mediaserver.komga.KomgaEventHandler
import snd.komf.mediaserver.komga.KomgaMediaServerClientAdapter
import snd.komf.mediaserver.metadata.MetadataEventHandler
import snd.komf.mediaserver.metadata.MetadataMapper
import snd.komf.mediaserver.metadata.MetadataMerger
import snd.komf.mediaserver.metadata.MetadataPostProcessor
import snd.komf.mediaserver.metadata.MetadataService
import snd.komf.mediaserver.metadata.MetadataUpdater
import snd.komf.mediaserver.metadata.repository.BookThumbnailsRepository
import snd.komf.mediaserver.metadata.repository.SeriesMatchRepository
import snd.komf.mediaserver.metadata.repository.SeriesThumbnailsRepository
import snd.komf.mediaserver.model.MediaServer
import snd.komf.mediaserver.model.MediaServerBookId
import snd.komf.mediaserver.model.MediaServerSeriesId
import snd.komf.mediaserver.model.MediaServerThumbnailId
import snd.komf.mediaserver.notifications.NotificationLogRepository
import snd.komf.mediaserver.repository.AutoDownloaderRule
import snd.komf.mediaserver.repository.BookThumbnail
import snd.komf.mediaserver.repository.Database
import snd.komf.mediaserver.repository.DownloadQueueItem
import snd.komf.mediaserver.repository.DownloadedChapter
import snd.komf.mediaserver.repository.KomfJobRecord
import snd.komf.mediaserver.repository.NotificationLog
import snd.komf.mediaserver.repository.SeriesMatch
import snd.komf.mediaserver.repository.SeriesThumbnail
import snd.komf.model.ProviderSeriesId
import snd.komf.notifications.apprise.AppriseCliService
import snd.komf.notifications.discord.DiscordWebhookService
import snd.komf.providers.ProvidersModule
import snd.komf.sources.MangaSourceId
import snd.komf.sources.MangaSourcesModule
import snd.komga.client.KomgaClientFactory
import java.nio.file.Path
import java.util.*
import kotlin.time.Instant

class MediaServerModule(
    komgaConfig: KomgaConfig,
    databaseConfig: DatabaseConfig,
    jsonBase: Json,
    ktorBaseClient: HttpClient,
    appriseService: AppriseCliService,
    discordWebhookService: DiscordWebhookService,
    private val metadataProviders: ProvidersModule.MetadataProviders,
    private val mangaSourcesModule: MangaSourcesModule,
    private val downloadConfig: DownloadConfig = DownloadConfig(),
    private val autoDownloaderConfig: AutoDownloaderConfig = AutoDownloaderConfig(),
) {
    private val mediaServerDatabase = createDatabase(Path.of(databaseConfig.file))
    val jobRepository = KomfJobsRepository(mediaServerDatabase.komfJobRecordQueries)
    val jobTracker = KomfJobTracker(jobRepository, databaseConfig.retentionDays)
    val notificationLogRepository = NotificationLogRepository(mediaServerDatabase.notificationLogQueries)

    val komgaClient: KomgaMediaServerClientAdapter
    val komgaMetadataServiceProvider: MetadataServiceProvider
    val downloadService: DownloadService
    val autoDownloaderService: AutoDownloaderService
    private val komgaBookThumbnailRepository: BookThumbnailsRepository
    private val komgaSerThumbnailsRepository: SeriesThumbnailsRepository
    private val komgaSeriesMatchRepository: SeriesMatchRepository
    private val komgaMetadataEventHandler: MetadataEventHandler
    private val komgaNotificationsHandler: NotificationsEventHandler?
    private val komgaEventHandler: KomgaEventHandler

    private val normalizedKomgaBaseUri = normalizeAndValidateBaseUri(komgaConfig.baseUri, "komga.baseUri")

    init {
        val komgaClientFactory = KomgaClientFactory.Builder()
            .ktor(ktorBaseClient)
            .cookieStorage(AcceptAllCookiesStorage())
            .username(komgaConfig.komgaUser)
            .password(komgaConfig.komgaPassword)
            .baseUrlBuilder { URLBuilder(normalizedKomgaBaseUri).appendPathSegments("/") }
            .useragent(komfUserAgent)
            .build()
        komgaClient = KomgaMediaServerClientAdapter(
            komgaClientFactory.bookClient(),
            komgaClientFactory.seriesClient(),
            komgaClientFactory.libraryClient(),
            komgaConfig.thumbnailSizeLimit
        )
        komgaBookThumbnailRepository = BookThumbnailsRepository(
            mediaServerDatabase.bookThumbnailQueries,
            MediaServer.KOMGA
        )
        komgaSerThumbnailsRepository = SeriesThumbnailsRepository(
            mediaServerDatabase.seriesThumbnailQueries,
            MediaServer.KOMGA
        )
        komgaSeriesMatchRepository = SeriesMatchRepository(
            mediaServerDatabase.seriesMatchQueries,
            MediaServer.KOMGA
        )
        komgaMetadataServiceProvider = createMetadataServiceProvider(
            config = komgaConfig.metadataUpdate,
            mediaServerClient = komgaClient,
            seriesThumbnailsRepository = komgaSerThumbnailsRepository,
            bookThumbnailsRepository = komgaBookThumbnailRepository,
            seriesMatchRepository = komgaSeriesMatchRepository,
        )

        komgaMetadataEventHandler = MetadataEventHandler(
            metadataServiceProvider = komgaMetadataServiceProvider,
            bookThumbnailsRepository = komgaBookThumbnailRepository,
            seriesThumbnailsRepository = komgaSerThumbnailsRepository,
            seriesMatchRepository = komgaSeriesMatchRepository,
            jobTracker = jobTracker,
            libraryFilter = {
                val libraries = komgaConfig.eventListener.metadataLibraryFilter
                if (libraries.isEmpty()) true
                else libraries.contains(it)
            },
            seriesFilter = { seriesId -> komgaConfig.eventListener.metadataSeriesExcludeFilter.none { seriesId == it } },
        )
        komgaNotificationsHandler = NotificationsEventHandler(
            mediaServerClient = komgaClient,
            appriseService = appriseService,
            discordWebhookService = discordWebhookService,
            libraryFilter = {
                val libraries = komgaConfig.eventListener.notificationsLibraryFilter
                if (libraries.isEmpty()) true
                else libraries.contains(it)
            },
            mediaServer = MediaServer.KOMGA,
            notificationLogRepository = notificationLogRepository,
        )

        komgaEventHandler = KomgaEventHandler(
            eventSourceFactory = { komgaClientFactory.sseSession() },
            eventListeners = listOfNotNull(komgaMetadataEventHandler, komgaNotificationsHandler),
        )


        if (komgaConfig.eventListener.enabled) {
            komgaEventHandler.start()
        }

        // Download engine setup
        val downloadQueueRepository = DownloadQueueRepository(mediaServerDatabase.downloadQueueItemQueries)
        val downloadedChaptersRepository = DownloadedChaptersRepository(mediaServerDatabase.downloadedChapterQueries)
        val autoDownloaderRuleRepository = AutoDownloaderRuleRepository(mediaServerDatabase.autoDownloaderRuleQueries)

        val chapterDownloader = ChapterDownloader(
            httpClient = ktorBaseClient,
            downloadConfig = downloadConfig,
        )
        val komgaImporter = if (downloadConfig.komgaLibraryPath != null) {
            KomgaImporter(komgaClient)
        } else null

        val downloadQueueManager = DownloadQueueManager(
            queueRepository = downloadQueueRepository,
            downloadedChaptersRepository = downloadedChaptersRepository,
            chapterDownloader = chapterDownloader,
            komgaImporter = komgaImporter,
            downloadConfig = downloadConfig,
            sourceProvider = { mangaSourcesModule.getSource(it) },
        )

        downloadService = DownloadService(
            sourcesModule = mangaSourcesModule,
            queueManager = downloadQueueManager,
            downloadedChaptersRepository = downloadedChaptersRepository,
        )
        downloadService.start()

        autoDownloaderService = AutoDownloaderService(
            ruleRepository = autoDownloaderRuleRepository,
            downloadService = downloadService,
            sourcesModule = mangaSourcesModule,
            config = autoDownloaderConfig,
        )
        autoDownloaderService.start()
    }

    fun close() {
        komgaEventHandler.stop()
    }

    private fun createMetadataServiceProvider(
        config: MetadataUpdateConfig,
        mediaServerClient: MediaServerClient,
        seriesThumbnailsRepository: SeriesThumbnailsRepository,
        bookThumbnailsRepository: BookThumbnailsRepository,
        seriesMatchRepository: SeriesMatchRepository,
    ): MetadataServiceProvider {
        val defaultUpdaterService = createMetadataUpdateService(
            config = config.default,
            mediaServerClient = mediaServerClient,
            seriesThumbnailsRepository = seriesThumbnailsRepository,
            bookThumbnailsRepository = bookThumbnailsRepository
        )

        val libraryUpdaterServices = config.library
            .map { (libraryId, config) ->
                libraryId to createMetadataUpdateService(
                    config = config,
                    mediaServerClient = mediaServerClient,
                    seriesThumbnailsRepository = seriesThumbnailsRepository,
                    bookThumbnailsRepository = bookThumbnailsRepository
                )
            }
            .toMap()

        val defaultMetadataService = createMetadataService(
            config = config.default,
            mediaServerClient = mediaServerClient,
            seriesMatchRepository = seriesMatchRepository,
            metadataUpdateService = defaultUpdaterService
        )
        val libraryMetadataServices = config.library
            .map { (libraryId, config) ->
                libraryId to createMetadataService(
                    config = config,
                    mediaServerClient = mediaServerClient,
                    seriesMatchRepository = seriesMatchRepository,
                    metadataUpdateService = libraryUpdaterServices[libraryId] ?: defaultUpdaterService
                )
            }
            .toMap()

        return MetadataServiceProvider(
            defaultMetadataService = defaultMetadataService,
            libraryMetadataServices = libraryMetadataServices,
            defaultUpdateService = defaultUpdaterService,
            libraryUpdaterServices = libraryUpdaterServices
        )
    }

    private fun createMetadataService(
        config: MetadataProcessingConfig,
        metadataUpdateService: MetadataUpdater,
        mediaServerClient: MediaServerClient,
        seriesMatchRepository: SeriesMatchRepository,
    ): MetadataService {
        return MetadataService(
            mediaServerClient = mediaServerClient,
            metadataProviders = metadataProviders,
            aggregateMetadata = config.aggregate,
            metadataUpdateService = metadataUpdateService,
            seriesMatchRepository = seriesMatchRepository,
            metadataMerger = MetadataMerger(mergeTags = config.mergeTags, mergeGenres = config.mergeGenres),
            libraryType = config.libraryType,
            jobTracker = jobTracker,
        )
    }

    private fun createMetadataUpdateService(
        config: MetadataProcessingConfig,
        mediaServerClient: MediaServerClient,
        seriesThumbnailsRepository: SeriesThumbnailsRepository,
        bookThumbnailsRepository: BookThumbnailsRepository,
    ): MetadataUpdater {
        val postProcessor = MetadataPostProcessor(
            libraryType = config.libraryType,
            seriesTitle = config.postProcessing.seriesTitle,
            seriesTitleLanguage = config.postProcessing.seriesTitleLanguage,
            alternativeSeriesTitles = config.postProcessing.alternativeSeriesTitles,
            alternativeSeriesTitleLanguages = config.postProcessing.alternativeSeriesTitleLanguages,
            orderBooks = config.postProcessing.orderBooks,
            readingDirectionValue = config.postProcessing.readingDirectionValue,
            languageValue = config.postProcessing.languageValue,
            fallbackToAltTitle = config.postProcessing.fallbackToAltTitle,

            scoreTagName = config.postProcessing.scoreTagName,
            originalPublisherTagName = config.postProcessing.originalPublisherTagName,
            publisherTagNames = config.postProcessing.publisherTagNames
        )

        return MetadataUpdater(
            mediaServerClient = mediaServerClient,
            seriesThumbnailsRepository = seriesThumbnailsRepository,
            bookThumbnailsRepository = bookThumbnailsRepository,
            metadataUpdateMapper = MetadataMapper(),
            postProcessor = postProcessor,
            comicInfoWriter = ComicInfoWriter.Companion.getInstance(config.overrideComicInfo),

            updateModes = config.updateModes.toSet(),
            uploadBookCovers = config.bookCovers,
            uploadSeriesCovers = config.seriesCovers,
            overrideExistingCovers = config.overrideExistingCovers,
            lockCovers = config.lockCovers,
        )
    }

    fun createDatabase(file: Path): Database {

        val dbDriver: SqlDriver =
            JdbcSqliteDriver(
                url = "jdbc:sqlite:${file}",
                schema = Database.Companion.Schema,
                migrateEmptySchema = true
            )
        val database = Database(
            dbDriver,
            BookThumbnailAdapter = BookThumbnail.Adapter(
                bookIdAdapter = BookIdAdapter,
                seriesIdAdapter = SeriesIdAdapter,
                thumbnailIdAdapter = ThumbnailIdAdapter,
                mediaServerAdapter = EnumColumnAdapter()
            ),
            KomfJobRecordAdapter = KomfJobRecord.Adapter(
                idAdapter = MetadataJobIdAdapter,
                seriesIdAdapter = SeriesIdAdapter,
                statusAdapter = EnumColumnAdapter(),
                startedAtAdapter = InstantAdapter,
                finishedAtAdapter = InstantAdapter,
            ),
            SeriesMatchAdapter = SeriesMatch.Adapter(
                seriesIdAdapter = SeriesIdAdapter,
                typeAdapter = EnumColumnAdapter(),
                mediaServerAdapter = EnumColumnAdapter(),
                providerAdapter = EnumColumnAdapter(),
                providerSeriesIdAdapter = ProviderSeriesIdIdAdapter,
            ),
            SeriesThumbnailAdapter = SeriesThumbnail.Adapter(
                seriesIdAdapter = SeriesIdAdapter,
                thumbnailIdAdapter = ThumbnailIdAdapter,
                mediaServerAdapter = EnumColumnAdapter()
            ),
            NotificationLogAdapter = NotificationLog.Adapter(
                sentAtAdapter = InstantAdapter,
            ),
            DownloadQueueItemAdapter = DownloadQueueItem.Adapter(
                idAdapter = DownloadItemIdAdapter,
                sourceIdAdapter = MangaSourceIdAdapter,
                statusAdapter = EnumColumnAdapter(),
                pausedAtAdapter = InstantAdapter,
                createdAtAdapter = InstantAdapter,
                updatedAtAdapter = InstantAdapter,
            ),
            DownloadedChapterAdapter = DownloadedChapter.Adapter(
                idAdapter = DownloadedChapterIdAdapter,
                sourceIdAdapter = MangaSourceIdAdapter,
                downloadedAtAdapter = InstantAdapter,
            ),
            AutoDownloaderRuleAdapter = AutoDownloaderRule.Adapter(
                idAdapter = AutoDownloaderRuleIdAdapter,
                sourceIdAdapter = MangaSourceIdAdapter,
            ),
        )
        return database
    }

    private object SeriesIdAdapter : ColumnAdapter<MediaServerSeriesId, String> {
        override fun decode(databaseValue: String) = MediaServerSeriesId(databaseValue)
        override fun encode(value: MediaServerSeriesId) = value.value
    }

    private object BookIdAdapter : ColumnAdapter<MediaServerBookId, String> {
        override fun decode(databaseValue: String) = MediaServerBookId(databaseValue)
        override fun encode(value: MediaServerBookId) = value.value
    }

    private object ThumbnailIdAdapter : ColumnAdapter<MediaServerThumbnailId, String> {
        override fun decode(databaseValue: String) = MediaServerThumbnailId(databaseValue)
        override fun encode(value: MediaServerThumbnailId) = value.value
    }

    private object ProviderSeriesIdIdAdapter : ColumnAdapter<ProviderSeriesId, String> {
        override fun decode(databaseValue: String) = ProviderSeriesId(databaseValue)
        override fun encode(value: ProviderSeriesId) = value.value
    }

    private object MetadataJobIdAdapter : ColumnAdapter<MetadataJobId, String> {
        override fun decode(databaseValue: String) = MetadataJobId(UUID.fromString(databaseValue))
        override fun encode(value: MetadataJobId) = value.value.toString()
    }

    private object InstantAdapter : ColumnAdapter<Instant, Long> {
        override fun decode(databaseValue: Long) = Instant.fromEpochMilliseconds(databaseValue)
        override fun encode(value: Instant) = value.toEpochMilliseconds()
    }

    private object DownloadItemIdAdapter : ColumnAdapter<DownloadItemId, String> {
        override fun decode(databaseValue: String) = DownloadItemId(databaseValue)
        override fun encode(value: DownloadItemId) = value.value
    }

    private object DownloadedChapterIdAdapter : ColumnAdapter<DownloadedChapterId, String> {
        override fun decode(databaseValue: String) = DownloadedChapterId(databaseValue)
        override fun encode(value: DownloadedChapterId) = value.value
    }

    private object MangaSourceIdAdapter : ColumnAdapter<MangaSourceId, String> {
        override fun decode(databaseValue: String) = MangaSourceId.valueOf(databaseValue)
        override fun encode(value: MangaSourceId) = value.name
    }

    private object AutoDownloaderRuleIdAdapter : ColumnAdapter<AutoDownloaderRuleId, String> {
        override fun decode(databaseValue: String) = AutoDownloaderRuleId(databaseValue)
        override fun encode(value: AutoDownloaderRuleId) = value.value
    }

    private fun normalizeAndValidateBaseUri(raw: String, fieldName: String): String {
        val normalized = raw.trim().removeSuffix("/")
        require(normalized.startsWith("http://") || normalized.startsWith("https://")) {
            "$fieldName must start with http:// or https:// (actual: '$raw')"
        }
        return normalized
    }
}
