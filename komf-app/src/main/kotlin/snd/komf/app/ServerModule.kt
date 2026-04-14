package snd.komf.app

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.HttpClient
import io.ktor.client.plugins.ResponseException
import io.ktor.http.CacheControl
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.CachingOptions
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.application.install
import io.ktor.server.cio.CIO
import io.ktor.server.engine.embeddedServer
import io.ktor.server.http.content.CompressedFileType
import io.ktor.server.http.content.staticResources
import io.ktor.server.plugins.cachingheaders.CachingHeaders
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.cors.routing.CORS
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.request.uri
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.server.sse.SSE
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import snd.komf.api.KomfErrorResponse
import java.util.concurrent.TimeoutException
import snd.komf.app.api.AutoDownloaderRoutes
import snd.komf.app.api.AuthRoutes
import snd.komf.app.api.ConfigRoutes
import snd.komf.app.api.DownloadRoutes
import snd.komf.app.api.JobRoutes
import snd.komf.app.api.ImageProxyRoutes
import snd.komf.app.api.KomgaProxyRoutes
import snd.komf.app.api.LogRoutes
import snd.komf.app.api.MediaServerRoutes
import snd.komf.app.api.MetadataRoutes
import snd.komf.app.api.NotificationRoutes
import snd.komf.app.api.SourceRoutes
import snd.komf.app.api.StorageRoutes
import snd.komf.app.api.VersionRoutes
import snd.komf.app.config.AppConfig
import snd.komf.mediaserver.MediaServerClient
import snd.komf.mediaserver.MetadataServiceProvider
import snd.komf.mediaserver.download.DownloadService
import snd.komf.mediaserver.download.auto.AutoDownloaderService
import snd.komf.mediaserver.jobs.KomfJobTracker
import snd.komf.mediaserver.jobs.KomfJobsRepository
import snd.komf.mediaserver.notifications.NotificationLogRepository
import snd.komf.notifications.apprise.AppriseCliService
import snd.komf.notifications.apprise.AppriseVelocityTemplates
import snd.komf.notifications.discord.DiscordVelocityTemplates
import snd.komf.notifications.discord.DiscordWebhookService
import snd.komf.providers.mangabaka.db.MangaBakaDbDownloader
import snd.komf.providers.mangabaka.db.MangaBakaDbMetadata
import snd.komf.sources.MangaSourcesModule
import snd.komf.sources.SourceHealthMonitor

private val logger = KotlinLogging.logger {}

class ServerModule(
    serverPort: Int,
    private val onConfigUpdate: suspend (AppConfig) -> Unit,
    private val dynamicDependencies: StateFlow<ApiDynamicDependencies>,
    private val httpClient: HttpClient,
) {

    private val json = Json {
        ignoreUnknownKeys = true
    }

    private val server = embeddedServer(CIO, port = serverPort) {
        install(ContentNegotiation) {
            json(json)
        }
        install(CORS) {
            allowMethod(HttpMethod.Get)
            allowMethod(HttpMethod.Post)
            allowMethod(HttpMethod.Patch)
            allowMethod(HttpMethod.Delete)
            allowMethod(HttpMethod.Options)
            allowHeaders { true }
            val allowedOrigin = System.getenv("KOMF_CORS_ALLOWED_ORIGIN")
            if (!allowedOrigin.isNullOrBlank()) {
                allowHost(allowedOrigin.removePrefix("https://").removePrefix("http://"),
                    schemes = listOf("http", "https"))
                logger.info { "CORS restricted to: $allowedOrigin" }
            } else {
                anyHost()
                logger.warn { "CORS allowing all origins. Set KOMF_CORS_ALLOWED_ORIGIN to restrict." }
            }
            allowNonSimpleContentTypes = true
        }
        install(SSE)

        // Security headers — skip X-Frame-Options and CSP for proxy routes so the
        // embedded Komga iframe can load resources without being blocked.
        install(createApplicationPlugin("SecurityHeaders") {
            onCall { call ->
                val uri = call.request.uri
                val isProxy = uri.startsWith("/komga-proxy/") ||
                    uri.startsWith("/api/v1/") ||
                    uri.startsWith("/api/image-proxy") ||
                    uri.startsWith("/sse/")

                call.response.header("X-Content-Type-Options", "nosniff")
                call.response.header("Referrer-Policy", "strict-origin-when-cross-origin")
                call.response.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

                if (!isProxy) {
                    call.response.header("X-Frame-Options", "SAMEORIGIN")
                    call.response.header(
                        "Content-Security-Policy",
                        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
                            "img-src 'self' data: blob:; connect-src 'self'; " +
                            "font-src 'self' data:; frame-src 'self'"
                    )
                }
            }
        })

        // Auth middleware — protect /api/* routes except /api/auth/*
        install(createApplicationPlugin("AuthMiddleware") {
            onCall { call ->
                val uri = call.request.uri
                // Only protect API routes (not static resources, not proxy, not auth endpoints)
                if (!uri.startsWith("/api/")) return@onCall
                if (uri.startsWith("/api/auth/")) return@onCall

                val config = dynamicDependencies.value.config
                // If auth is not configured, skip (backwards compatible)
                if (config.auth.username.isBlank() || config.auth.passwordHash.isBlank()) return@onCall

                val cookie = call.request.cookies["komf-session"]
                val validUser = cookie?.let { AuthRoutes.validateSessionToken(it, config.auth.sessionSecret) }
                if (validUser == null) {
                    call.respond(HttpStatusCode.Unauthorized, KomfErrorResponse("Authentication required"))
                }
            }
        })

        install(CachingHeaders) {
            options { call, content ->
                val path = call.request.uri
                // Service-worker files must never be long-cached so browsers always pick up updates
                val isSW = path == "/sw.js" || path == "/registerSW.js"
                when {
                    isSW ->
                        CachingOptions(CacheControl.NoStore(null))
                    content.contentType?.match(ContentType.Application.Json) == true ->
                        CachingOptions(CacheControl.NoStore(null))
                    content.contentType?.match(ContentType.Text.Html) == true ->
                        CachingOptions(CacheControl.NoStore(null))
                    content.contentType?.match(ContentType.Application.JavaScript) == true ->
                        CachingOptions(CacheControl.MaxAge(maxAgeSeconds = 31536000, visibility = CacheControl.Visibility.Public))
                    content.contentType?.match(ContentType.Text.CSS) == true ->
                        CachingOptions(CacheControl.MaxAge(maxAgeSeconds = 31536000, visibility = CacheControl.Visibility.Public))
                    content.contentType?.match(ContentType.Image.Any) == true ->
                        CachingOptions(CacheControl.MaxAge(maxAgeSeconds = 3600, visibility = CacheControl.Visibility.Public))
                    else -> null
                }
            }
        }
        install(StatusPages) {
            exception<IllegalArgumentException> { call, cause ->
                call.respond(
                    HttpStatusCode.BadRequest,
                    KomfErrorResponse("${cause::class.simpleName}: ${cause.message}")
                )
            }
            exception<IllegalStateException> { call, cause ->
                call.respond(
                    HttpStatusCode.InternalServerError,
                    KomfErrorResponse("${cause::class.simpleName}: ${cause.message}")
                )
            }
            exception<NoSuchElementException> { call, cause ->
                call.respond(
                    HttpStatusCode.NotFound,
                    KomfErrorResponse(cause.message ?: "Resource not found")
                )
            }
            exception<TimeoutException> { call, cause ->
                call.respond(
                    HttpStatusCode.GatewayTimeout,
                    KomfErrorResponse("Upstream request timed out: ${cause.message}")
                )
            }
            exception<ResponseException> { call, cause ->
                call.respond(
                    cause.response.status,
                    KomfErrorResponse("Upstream error: ${cause.message}")
                )
            }
            exception<Exception> { call, cause ->
                logger.error(cause) { "Unhandled exception" }
                call.respond(
                    HttpStatusCode.InternalServerError,
                    KomfErrorResponse("Internal server error")
                )
            }
        }

        routing {
            val komgaProxy = KomgaProxyRoutes(
                httpClient = httpClient,
                appConfig = dynamicDependencies.map { it.config },
            )
            komgaProxy.registerRoutes(this)

            route("/api") {
                AuthRoutes(
                    appConfig = dynamicDependencies.map { it.config },
                    onConfigUpdate = onConfigUpdate,
                ).registerRoutes(this)

                ConfigRoutes(
                    config = dynamicDependencies.map { it.config },
                    onConfigUpdate = onConfigUpdate,
                    mangaBakaDownloader = dynamicDependencies.map { it.mangaBakaDownloader },
                    mangaBakaDbMetadata = dynamicDependencies.map { it.mangaBakaDbMetadata },
                    json = json,
                ).registerRoutes(this)
                JobRoutes(
                    jobTracker = dynamicDependencies.map { it.jobTracker },
                    jobsRepository = dynamicDependencies.map { it.jobsRepository },
                    json = json,
                    metadataServiceProvider = dynamicDependencies.map { it.komgaMetadataServiceProvider },
                    mediaServerClient = dynamicDependencies.map { it.komgaMediaServerClient },
                ).registerRoutes(this)

                NotificationRoutes(
                    discordService = dynamicDependencies.map { it.discordService },
                    discordRenderer = dynamicDependencies.map { it.discordRenderer },
                    appriseService = dynamicDependencies.map { it.appriseService },
                    appriseRenderer = dynamicDependencies.map { it.appriseRenderer },
                    notificationLogRepository = dynamicDependencies.map { it.notificationLogRepository },
                ).registerRoutes(this)

                LogRoutes().registerRoutes(this)

                VersionRoutes(
                    httpClient = httpClient,
                    currentVersion = "1.0.0",
                ).registerRoutes(this)

                route("/komga") {
                    MetadataRoutes(
                        metadataServiceProvider = dynamicDependencies.map { it.komgaMetadataServiceProvider },
                        mediaServerClient = dynamicDependencies.map { it.komgaMediaServerClient },
                        appConfig = dynamicDependencies.map { it.config },
                    ).registerRoutes(this)

                    MediaServerRoutes(
                        mediaServerClient = dynamicDependencies.map { it.komgaMediaServerClient }
                    ).registerRoutes(this)
                }

                SourceRoutes(
                    sourcesModule = dynamicDependencies.map { it.mangaSourcesModule },
                    healthMonitor = dynamicDependencies.map { it.sourceHealthMonitor },
                ).registerRoutes(this)

                DownloadRoutes(
                    downloadService = dynamicDependencies.map { it.downloadService },
                    json = json,
                ).registerRoutes(this)

                AutoDownloaderRoutes(
                    autoDownloaderService = dynamicDependencies.map { it.autoDownloaderService },
                ).registerRoutes(this)

                ImageProxyRoutes(
                    httpClient = httpClient,
                ).registerRoutes(this)

                StorageRoutes(
                    config = dynamicDependencies.map { it.config },
                ).registerRoutes(this)
            }

            // Static resources LAST so the SPA catch-all doesn't intercept proxy/API routes
            staticResources(remotePath = "/", basePackage = "komelia", index = "index.html") {
                default("index.html")
                preCompressed(CompressedFileType.GZIP)
            }
        }
    }

    fun startServer() {
        server.start(wait = true)
    }
}

class ApiDynamicDependencies(
    val config: AppConfig,
    val jobTracker: KomfJobTracker,
    val jobsRepository: KomfJobsRepository,
    val komgaMediaServerClient: MediaServerClient,
    val komgaMetadataServiceProvider: MetadataServiceProvider,
    val discordService: DiscordWebhookService,
    val discordRenderer: DiscordVelocityTemplates,
    val appriseService: AppriseCliService,
    val appriseRenderer: AppriseVelocityTemplates,
    val mangaBakaDownloader: MangaBakaDbDownloader,
    val mangaBakaDbMetadata: MangaBakaDbMetadata,
    val notificationLogRepository: NotificationLogRepository,
    val mangaSourcesModule: MangaSourcesModule,
    val sourceHealthMonitor: SourceHealthMonitor,
    val downloadService: DownloadService,
    val autoDownloaderService: AutoDownloaderService,
)
