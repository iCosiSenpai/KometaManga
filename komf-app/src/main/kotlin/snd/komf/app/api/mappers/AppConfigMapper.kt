package snd.komf.app.api.mappers

import snd.komf.api.MangaBakaMode
import snd.komf.api.MangaDexLink
import snd.komf.api.config.AniListConfigDto
import snd.komf.api.config.AppriseConfigDto
import snd.komf.api.config.AutoDownloaderConfigDto
import snd.komf.api.config.BookMetadataConfigDto
import snd.komf.api.config.DiscordConfigDto
import snd.komf.api.config.DownloadConfigDto
import snd.komf.api.config.DownloadTargetDto
import snd.komf.api.config.EnvLocksDto
import snd.komf.api.config.EventListenerConfigDto
import snd.komf.api.config.KomfConfig
import snd.komf.api.config.KomgaConfigDto
import snd.komf.api.config.MangaBakaConfigDto
import snd.komf.api.config.MangaBakaDatabaseDto
import snd.komf.api.config.MangaDexConfigDto
import snd.komf.api.config.MetadataPostProcessingConfigDto
import snd.komf.api.config.MetadataProcessingConfigDto
import snd.komf.api.config.MetadataProvidersConfigDto
import snd.komf.api.config.MetadataUpdateConfigDto
import snd.komf.api.config.NotificationConfigDto
import snd.komf.api.config.ProviderConfigDto
import snd.komf.api.config.ProvidersConfigDto
import snd.komf.api.config.PublisherTagNameConfigDto
import snd.komf.api.config.SchedulerConfigDto
import snd.komf.api.config.SeriesMetadataConfigDto
import snd.komf.app.config.AppConfig
import snd.komf.app.config.SchedulerConfig
import snd.komf.mediaserver.config.EventListenerConfig
import snd.komf.mediaserver.config.KomgaConfig
import snd.komf.mediaserver.config.MetadataPostProcessingConfig
import snd.komf.mediaserver.config.MetadataProcessingConfig
import snd.komf.mediaserver.config.MetadataUpdateConfig
import snd.komf.mediaserver.download.AutoDownloaderConfig
import snd.komf.mediaserver.download.DownloadConfig
import snd.komf.notifications.NotificationsConfig
import snd.komf.notifications.apprise.AppriseConfig
import snd.komf.notifications.discord.DiscordConfig
import snd.komf.providers.AniListConfig
import snd.komf.providers.BookMetadataConfig
import snd.komf.providers.MangaBakaConfig
import snd.komf.providers.MangaDexConfig
import snd.komf.providers.MetadataProvidersConfig
import snd.komf.providers.ProviderConfig
import snd.komf.providers.ProvidersConfig
import snd.komf.providers.SeriesMetadataConfig
import snd.komf.providers.mangabaka.db.MangaBakaDbMetadata

class AppConfigMapper {
    private val maskedPlaceholder = "********"

    fun toDto(
        config: AppConfig,
        mangaBakaDbMetadata: MangaBakaDbMetadata
    ): KomfConfig {
        return KomfConfig(
            metadataProviders = toDto(config.metadataProviders, mangaBakaDbMetadata),
            komga = toDto(config.komga),
            notifications = toDto(config.notifications),
            scheduler = toDto(config.scheduler),
            download = toDto(config.download),
            autoDownloader = toDto(config.autoDownloader),
            envLocks = envLocks(),
        )
    }

    private fun envLocks(): EnvLocksDto {
        fun isSet(name: String): Boolean = System.getenv(name).isNullOrBlank().not()

        return EnvLocksDto(
            komgaBaseUri = isSet("KOMF_KOMGA_BASE_URI"),
            komgaUser = isSet("KOMF_KOMGA_USER"),
            komgaPassword = isSet("KOMF_KOMGA_PASSWORD"),
            serverPort = isSet("KOMF_SERVER_PORT"),
            logLevel = isSet("KOMF_LOG_LEVEL"),
            discordWebhooks = isSet("KOMF_DISCORD_WEBHOOKS"),
            appriseUrls = isSet("KOMF_APPRISE_URLS"),
            malClientId = isSet("KOMF_METADATA_PROVIDERS_MAL_CLIENT_ID"),
            comicVineApiKey = isSet("KOMF_METADATA_PROVIDERS_COMIC_VINE_API_KEY"),
            comicVineSearchLimit = isSet("KOMF_METADATA_PROVIDERS_COMIC_VINE_SEARCH_LIMIT"),
            bangumiToken = isSet("KOMF_METADATA_PROVIDERS_BANGUMI_TOKEN"),
            downloadDir = isSet("KOMF_DOWNLOAD_DIR"),
            downloadCbzCompression = isSet("KOMF_DOWNLOAD_CBZ_COMPRESSION"),
            downloadConcurrentPages = isSet("KOMF_DOWNLOAD_CONCURRENT_PAGES"),
            downloadAutoScan = isSet("KOMF_DOWNLOAD_AUTO_SCAN"),
            autoDownloaderEnabled = isSet("KOMF_AUTO_DOWNLOADER_ENABLED"),
            autoDownloaderInterval = isSet("KOMF_AUTO_DOWNLOADER_INTERVAL"),
            schedulerAutoMatchEnabled = isSet("KOMF_SCHEDULER_AUTO_MATCH_ENABLED"),
            schedulerAutoMatchInterval = isSet("KOMF_SCHEDULER_AUTO_MATCH_INTERVAL"),
        )
    }

    private fun toDto(config: KomgaConfig): KomgaConfigDto {
        return KomgaConfigDto(
            baseUri = config.baseUri,
            komgaUser = config.komgaUser,
            eventListener = toDto(config.eventListener),
            metadataUpdate = toDto(config.metadataUpdate),
        )
    }

    private fun toDto(config: EventListenerConfig): EventListenerConfigDto {
        return EventListenerConfigDto(
            enabled = config.enabled,
            metadataLibraryFilter = config.metadataLibraryFilter,
            metadataSeriesExcludeFilter = config.metadataSeriesExcludeFilter,
            notificationsLibraryFilter = config.notificationsLibraryFilter
        )
    }

    private fun toDto(config: MetadataUpdateConfig): MetadataUpdateConfigDto {
        return MetadataUpdateConfigDto(
            default = toDto(config.default),
            library = config.library.map { (libraryId, config) -> libraryId to toDto(config) }.toMap()
        )
    }

    private fun toDto(config: MetadataProcessingConfig): MetadataProcessingConfigDto {
        return MetadataProcessingConfigDto(
            libraryType = config.libraryType.fromMediaType(),
            aggregate = config.aggregate,
            mergeTags = config.mergeTags,
            mergeGenres = config.mergeGenres,
            bookCovers = config.bookCovers,
            seriesCovers = config.seriesCovers,
            overrideExistingCovers = config.overrideExistingCovers,
            lockCovers = config.lockCovers,
            updateModes = config.updateModes.map { it.fromUpdateMode() },
            postProcessing = toDto(config.postProcessing),
        )
    }

    private fun toDto(config: MetadataPostProcessingConfig): MetadataPostProcessingConfigDto {
        return MetadataPostProcessingConfigDto(
            seriesTitle = config.seriesTitle,
            seriesTitleLanguage = config.seriesTitleLanguage,
            alternativeSeriesTitles = config.alternativeSeriesTitles,
            alternativeSeriesTitleLanguages = config.alternativeSeriesTitleLanguages,
            orderBooks = config.orderBooks,
            readingDirectionValue = config.readingDirectionValue?.fromReadingDirection(),
            languageValue = config.languageValue,
            fallbackToAltTitle = config.fallbackToAltTitle,
            scoreTagName = config.scoreTagName,
            originalPublisherTagName = config.originalPublisherTagName,
            publisherTagNames = config.publisherTagNames.map { PublisherTagNameConfigDto(it.tagName, it.language) }
        )
    }

    private fun toDto(
        config: MetadataProvidersConfig,
        mangaBakaDbMetadata: MangaBakaDbMetadata
    ): MetadataProvidersConfigDto {
        val malClientId = config.malClientId?.let { clientId ->
            if (clientId.length < 32) maskedPlaceholder
            else clientId.replace("(?<=.{4}).".toRegex(), "*")
        }

        val comicVineClientId = config.comicVineApiKey?.let { apiKey ->
            if (apiKey.length < 40) maskedPlaceholder
            else apiKey.replace("(?<=.{4}).".toRegex(), "*")
        }

        return MetadataProvidersConfigDto(
            malClientId = malClientId,
            comicVineClientId = comicVineClientId,
            comicVineSearchLimit = config.comicVineSearchLimit,
            comicVineIssueName = config.comicVineIssueName,
            comicVineIdFormat = config.comicVineIdFormat,
            nameMatchingMode = config.nameMatchingMode.fromNameMatchingMode(),
            defaultProviders = toDto(config.defaultProviders),
            libraryProviders = config.libraryProviders
                .map { (libraryId, config) -> libraryId to toDto(config) }
                .toMap(),
            mangaBakaDatabase = toDto(mangaBakaDbMetadata),
        )
    }

    fun toDto(metadata: MangaBakaDbMetadata): MangaBakaDatabaseDto? {
        val timestamp = metadata.timestamp
        val checksum = metadata.checksum
        return if (timestamp == null || checksum == null) null
        else MangaBakaDatabaseDto(
            downloadTimestamp = timestamp,
            checksum = checksum
        )
    }

    private fun toDto(config: ProvidersConfig): ProvidersConfigDto {
        return ProvidersConfigDto(
            mangaUpdates = toDto(config.mangaUpdates),
            mal = toDto(config.mal),
            nautiljon = toDto(config.nautiljon),
            aniList = toDto(config.aniList),
            yenPress = toDto(config.yenPress),
            kodansha = toDto(config.kodansha),
            viz = toDto(config.viz),
            bookWalker = toDto(config.bookWalker),
            mangaDex = toDto(config.mangaDex),
            bangumi = toDto(config.bangumi),
            comicVine = toDto(config.comicVine),
            hentag = toDto(config.hentag),
            mangaBaka = toDto(config.mangaBaka),
            webtoons = toDto(config.webtoons),
        )
    }

    private fun toDto(config: ProviderConfig): ProviderConfigDto {
        return ProviderConfigDto(
            nameMatchingMode = config.nameMatchingMode?.fromNameMatchingMode(),
            priority = config.priority,
            enabled = config.enabled,
            mediaType = config.mediaType.fromMediaType(),
            authorRoles = config.authorRoles.map { it.fromAuthorRole() },
            artistRoles = config.artistRoles.map { it.fromAuthorRole() },
            seriesMetadata = toDto(config.seriesMetadata),
            bookMetadata = toDto(config.bookMetadata),
        )
    }

    private fun toDto(config: AniListConfig): AniListConfigDto {
        return AniListConfigDto(
            nameMatchingMode = config.nameMatchingMode?.fromNameMatchingMode(),
            priority = config.priority,
            enabled = config.enabled,
            mediaType = config.mediaType.fromMediaType(),

            authorRoles = config.authorRoles.map { it.fromAuthorRole() },
            artistRoles = config.artistRoles.map { it.fromAuthorRole() },
            seriesMetadata = toDto(config.seriesMetadata),

            tagsScoreThreshold = config.tagsScoreThreshold,
            tagsSizeLimit = config.tagsSizeLimit,
        )
    }

    private fun toDto(config: MangaDexConfig): MangaDexConfigDto {
        return MangaDexConfigDto(
            priority = config.priority,
            enabled = config.enabled,
            seriesMetadata = toDto(config.seriesMetadata),
            bookMetadata = toDto(config.bookMetadata),
            nameMatchingMode = config.nameMatchingMode?.fromNameMatchingMode(),
            mediaType = config.mediaType.fromMediaType(),

            authorRoles = config.authorRoles.map { it.fromAuthorRole() },
            artistRoles = config.artistRoles.map { it.fromAuthorRole() },
            coverLanguages = config.coverLanguages,
            links = config.links.map { MangaDexLink.valueOf(it.name) }
        )
    }

    private fun toDto(config: MangaBakaConfig): MangaBakaConfigDto {
        return MangaBakaConfigDto(
            nameMatchingMode = config.nameMatchingMode?.fromNameMatchingMode(),
            priority = config.priority,
            enabled = config.enabled,
            mediaType = config.mediaType.fromMediaType(),
            authorRoles = config.authorRoles.map { it.fromAuthorRole() },
            artistRoles = config.artistRoles.map { it.fromAuthorRole() },
            seriesMetadata = toDto(config.seriesMetadata),
            mode = MangaBakaMode.valueOf(config.mode.name)
        )
    }

    private fun toDto(config: SeriesMetadataConfig): SeriesMetadataConfigDto {
        return SeriesMetadataConfigDto(
            status = config.status,
            title = config.title,
            summary = config.summary,
            publisher = config.publisher,
            readingDirection = config.readingDirection,
            ageRating = config.ageRating,
            language = config.language,
            genres = config.genres,
            tags = config.tags,
            totalBookCount = config.totalBookCount,
            authors = config.authors,
            releaseDate = config.releaseDate,
            thumbnail = config.thumbnail,
            links = config.links,
            books = config.books,
            useOriginalPublisher = config.useOriginalPublisher,
            originalPublisherTagName = "",
            englishPublisherTagName = "",
            frenchPublisherTagName = "",
        )
    }

    private fun toDto(config: BookMetadataConfig): BookMetadataConfigDto {
        return BookMetadataConfigDto(
            title = config.title,
            summary = config.summary,
            number = config.number,
            numberSort = config.numberSort,
            releaseDate = config.releaseDate,
            authors = config.authors,
            tags = config.tags,
            isbn = config.isbn,
            links = config.links,
            thumbnail = config.thumbnail
        )
    }

    private fun toDto(config: NotificationsConfig): NotificationConfigDto {
        return NotificationConfigDto(
            apprise = toDto(config.apprise),
            discord = toDto(config.discord),
        )
    }

    private fun toDto(config: DiscordConfig): DiscordConfigDto {
        return DiscordConfigDto(
            webhooks = config.webhooks
                ?.map {
                    if (it.length < 110) maskedPlaceholder
                    else it.replace("(?<=.{34}).(?=.{10})".toRegex(), "*")
                },
            seriesCover = config.seriesCover,
        )
    }

    private fun toDto(config: AppriseConfig): AppriseConfigDto {
        return AppriseConfigDto(
            urls = config.urls?.map { it.take(7) + "*".repeat(50) },
            seriesCover = config.seriesCover,
        )
    }

    private fun toDto(config: SchedulerConfig): SchedulerConfigDto {
        return SchedulerConfigDto(
            autoMatchEnabled = config.autoMatchEnabled,
            autoMatchIntervalHours = config.autoMatchIntervalHours,
        )
    }

    private fun toDto(config: DownloadConfig): DownloadConfigDto {
        return DownloadConfigDto(
            downloadDir = config.downloadDir,
            komgaLibraryId = config.komgaLibraryId,
            komgaLibraryPath = config.komgaLibraryPath,
            autoScanAfterDownload = config.autoScanAfterDownload,
            cbzCompression = config.cbzCompression,
            concurrentPageDownloads = config.concurrentPageDownloads,
            extraTargets = config.extraTargets.map {
                DownloadTargetDto(
                    id = it.id,
                    name = it.name,
                    containerPath = it.containerPath,
                    komgaLibraryId = it.komgaLibraryId,
                    komgaLibraryPath = it.komgaLibraryPath,
                )
            },
        )
    }

    private fun toDto(config: AutoDownloaderConfig): AutoDownloaderConfigDto {
        return AutoDownloaderConfigDto(
            enabled = config.enabled,
            intervalHours = config.intervalHours,
            notifyOnNewChapters = config.notifyOnNewChapters,
        )
    }

}
