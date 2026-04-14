package snd.komf.app.api

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.response.respondBytesWriter
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.utils.io.writeStringUtf8
import java.io.File
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import snd.komf.api.KomfErrorResponse
import snd.komf.api.config.KomfConfigUpdateRequest
import snd.komf.app.api.mappers.AppConfigMapper
import snd.komf.app.api.mappers.AppConfigUpdateMapper
import snd.komf.app.config.AppConfig
import snd.komf.providers.mangabaka.db.MangaBakaDbDownloader
import snd.komf.providers.mangabaka.db.MangaBakaDbMetadata
import snd.komf.providers.mangabaka.db.MangaBakaDownloadProgress.ErrorEvent
import snd.komf.providers.mangabaka.db.MangaBakaDownloadProgress.FinishedEvent
import snd.komf.providers.mangabaka.db.MangaBakaDownloadProgress.ProgressEvent

private val logger = KotlinLogging.logger {}

class ConfigRoutes(
    private val config: Flow<AppConfig>,
    private val onConfigUpdate: suspend (AppConfig) -> Unit,
    private val mangaBakaDownloader: Flow<MangaBakaDbDownloader>,
    private val mangaBakaDbMetadata: Flow<MangaBakaDbMetadata>,
    private val json: Json,
) {
    private val configMapper = AppConfigMapper()
    private val updateConfigMapper = AppConfigUpdateMapper()
    private val mutex = Mutex()

    fun registerRoutes(routing: Route) {
        with(routing) {
            getConfigRoute()
            updateConfigRoute()
            validateConfigRoute()
            validateDirRoute()
            updateMangaBakaDB()
        }
    }

    private fun Route.getConfigRoute() {
        get("/config") {
            call.respond(
                configMapper.toDto(
                    config = config.first(),
                    mangaBakaDbMetadata = mangaBakaDbMetadata.first()
                )
            )
        }
    }

    private fun Route.updateConfigRoute() {
        patch("/config") {
            mutex.withLock {
                val request = call.receive<KomfConfigUpdateRequest>()
                val currentConfig = config.first()
                val updatedConfig = updateConfigMapper.patch(currentConfig, request)
                val envOverrideErrors = envOverrideConflictErrors(currentConfig, updatedConfig)
                if (envOverrideErrors.isNotEmpty()) {
                    call.respond(
                        HttpStatusCode.UnprocessableEntity,
                        KomfErrorResponse(envOverrideErrors.joinToString("\n"))
                    )
                    return@patch
                }
                try {
                    onConfigUpdate(updatedConfig)
                } catch (e: Exception) {
                    logger.catching(e)
                    call.respond(
                        HttpStatusCode.UnprocessableEntity,
                        KomfErrorResponse("${e::class.simpleName}: ${e.message}")
                    )
                    return@patch
                }

            }
            call.response.status(HttpStatusCode.NoContent)
        }
    }

    @kotlinx.serialization.Serializable
    private data class ConfigValidationResult(
        val valid: Boolean,
        val errors: List<String>,
    )

    private fun Route.validateConfigRoute() {
        post("/config/validate") {
            val request = call.receive<KomfConfigUpdateRequest>()
            val currentConfig = config.first()
            val merged = updateConfigMapper.patch(currentConfig, request)
            val errors = mutableListOf<String>()

            errors.addAll(envOverrideConflictErrors(currentConfig, merged))

            // Validate Komga connection
            val komgaBase = merged.komga.baseUri
            if (komgaBase.isNotBlank() && !komgaBase.startsWith("http://") && !komgaBase.startsWith("https://")) {
                errors.add("Komga base URI must start with http:// or https://")
            }
            if (komgaBase.isNotBlank() && merged.komga.komgaUser.isBlank()) {
                errors.add("Komga user must not be empty when base URI is set")
            }
            if (komgaBase.isNotBlank() && merged.komga.komgaPassword.isBlank()) {
                errors.add("Komga password must not be empty when base URI is set")
            }

            // Validate Discord webhook URLs
            val discordWebhookUrls = merged.notifications.discord.webhooks
            if (discordWebhookUrls != null) {
                for (url in discordWebhookUrls) {
                    if (!url.startsWith("https://discord.com/api/webhooks/") && !url.startsWith("https://discordapp.com/api/webhooks/")) {
                        errors.add("Invalid Discord webhook URL: $url")
                    }
                }
            }

            // Validate port range
            if (merged.server.port !in 1..65535) {
                errors.add("Server port must be between 1 and 65535")
            }

            call.respond(ConfigValidationResult(valid = errors.isEmpty(), errors = errors))
        }
    }

    @kotlinx.serialization.Serializable
    private data class DirValidationResult(
        val exists: Boolean,
        val writable: Boolean,
        val fileCount: Int,
        val sampleFiles: List<String>,
    )

    @kotlinx.serialization.Serializable
    private data class DirValidationRequest(val path: String)

    private fun Route.validateDirRoute() {
        post("/config/validate-dir") {
            val request = call.receive<DirValidationRequest>()
            val path = request.path.trim()
            if (path.isBlank()) {
                call.respond(DirValidationResult(exists = false, writable = false, fileCount = 0, sampleFiles = emptyList()))
                return@post
            }
            val dir = File(path)
            val exists = dir.exists() && dir.isDirectory
            val writable = exists && dir.canWrite()
            val files = if (exists) dir.listFiles()?.take(100) ?: emptyList() else emptyList()
            val fileCount = files.size
            val sampleFiles = files.take(5).map { it.name }
            call.respond(DirValidationResult(exists = exists, writable = writable, fileCount = fileCount, sampleFiles = sampleFiles))
        }
    }

    private fun envOverrideConflictErrors(current: AppConfig, updated: AppConfig): List<String> {
        val errors = mutableListOf<String>()

        fun check(envVar: String, changed: Boolean, field: String) {
            if (System.getenv(envVar).isNullOrBlank().not() && changed) {
                errors.add("$field is managed by environment variable $envVar and cannot be changed from the UI")
            }
        }

        // Komga fields are now hybrid: env vars provide initial values but can be overridden via UI
        // check("KOMF_KOMGA_BASE_URI", current.komga.baseUri != updated.komga.baseUri, "komga.baseUri")
        // check("KOMF_KOMGA_USER", current.komga.komgaUser != updated.komga.komgaUser, "komga.komgaUser")
        // check("KOMF_KOMGA_PASSWORD", current.komga.komgaPassword != updated.komga.komgaPassword, "komga.komgaPassword")

        check("KOMF_SERVER_PORT", current.server.port != updated.server.port, "server.port")
        check("KOMF_LOG_LEVEL", current.logLevel != updated.logLevel, "logLevel")

        check(
            "KOMF_DISCORD_WEBHOOKS",
            current.notifications.discord.webhooks != updated.notifications.discord.webhooks,
            "notifications.discord.webhooks"
        )
        check(
            "KOMF_APPRISE_URLS",
            current.notifications.apprise.urls != updated.notifications.apprise.urls,
            "notifications.apprise.urls"
        )

        check(
            "KOMF_METADATA_PROVIDERS_MAL_CLIENT_ID",
            current.metadataProviders.malClientId != updated.metadataProviders.malClientId,
            "metadataProviders.malClientId"
        )
        check(
            "KOMF_METADATA_PROVIDERS_COMIC_VINE_API_KEY",
            current.metadataProviders.comicVineApiKey != updated.metadataProviders.comicVineApiKey,
            "metadataProviders.comicVineApiKey"
        )
        check(
            "KOMF_METADATA_PROVIDERS_COMIC_VINE_SEARCH_LIMIT",
            current.metadataProviders.comicVineSearchLimit != updated.metadataProviders.comicVineSearchLimit,
            "metadataProviders.comicVineSearchLimit"
        )
        check(
            "KOMF_METADATA_PROVIDERS_BANGUMI_TOKEN",
            current.metadataProviders.bangumiToken != updated.metadataProviders.bangumiToken,
            "metadataProviders.bangumiToken"
        )

        check("KOMF_DOWNLOAD_DIR", current.download.downloadDir != updated.download.downloadDir, "download.downloadDir")
        check("KOMF_DOWNLOAD_CBZ_COMPRESSION", current.download.cbzCompression != updated.download.cbzCompression, "download.cbzCompression")
        check("KOMF_DOWNLOAD_CONCURRENT_PAGES", current.download.concurrentPageDownloads != updated.download.concurrentPageDownloads, "download.concurrentPageDownloads")
        check("KOMF_DOWNLOAD_AUTO_SCAN", current.download.autoScanAfterDownload != updated.download.autoScanAfterDownload, "download.autoScanAfterDownload")
        check("KOMF_AUTO_DOWNLOADER_ENABLED", current.autoDownloader.enabled != updated.autoDownloader.enabled, "autoDownloader.enabled")
        check("KOMF_AUTO_DOWNLOADER_INTERVAL", current.autoDownloader.intervalHours != updated.autoDownloader.intervalHours, "autoDownloader.intervalHours")
        check("KOMF_SCHEDULER_AUTO_MATCH_ENABLED", current.scheduler.autoMatchEnabled != updated.scheduler.autoMatchEnabled, "scheduler.autoMatchEnabled")
        check("KOMF_SCHEDULER_AUTO_MATCH_INTERVAL", current.scheduler.autoMatchIntervalHours != updated.scheduler.autoMatchIntervalHours, "scheduler.autoMatchIntervalHours")

        return errors
    }

    private fun Route.updateMangaBakaDB() {
        post("/update-manga-baka-db") {
            val downloader = mangaBakaDownloader.first()

            call.respondBytesWriter(contentType = ContentType("application", "jsonl")) {
                downloader.launchDownload().collect { event ->
                    val mappedEvent = when (event) {
                        is ProgressEvent -> snd.komf.api.config.MangaBakaDownloadProgress.ProgressEvent(
                            event.total,
                            event.completed,
                            event.info
                        )

                        is ErrorEvent -> snd.komf.api.config.MangaBakaDownloadProgress.ErrorEvent(event.message)
                        FinishedEvent -> snd.komf.api.config.MangaBakaDownloadProgress.FinishedEvent
                    }
                    writeStringUtf8(json.encodeToString(mappedEvent) + "\n")
                    flush()
                }
            }

            call.respond(HttpStatusCode.OK)
        }
    }
}
