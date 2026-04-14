package snd.komf.app

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import com.charleskorn.kaml.Yaml
import com.charleskorn.kaml.YamlConfiguration
import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.UserAgent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.Cache
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import org.slf4j.LoggerFactory
import snd.komf.CoreModule
import snd.komf.app.config.AppConfig
import snd.komf.app.config.ConfigLoader
import snd.komf.app.config.ConfigWriter
import snd.komf.ktor.komfUserAgent
import snd.komf.mediaserver.MediaServerModule
import snd.komf.notifications.NotificationsModule
import snd.komf.sources.MangaSourcesModule
import snd.komf.sources.SourceHealthMonitor
import java.nio.file.Path
import java.util.concurrent.TimeUnit
import kotlin.io.path.createDirectories
import kotlin.io.path.isDirectory

private val logger = KotlinLogging.logger {}
private val SENSITIVE_HEADER_REGEX = Regex(
    "((?:Authorization|Cookie|Set-Cookie|Proxy-Authorization):\\s*).+",
    RegexOption.IGNORE_CASE
)

class AppContext(private val configPath: Path? = null) {
    @Volatile
    var appConfig: AppConfig
        private set

    private val reloadMutex = Mutex()

    private val ktorBaseClient: HttpClient
    private val ktorProxyClient: HttpClient
    private val jsonBase: Json
    private val serverModule: ServerModule

    private var providersModule: CoreModule
    private var mediaServerModule: MediaServerModule
    private var notificationsModule: NotificationsModule
    private var mangaSourcesModule: MangaSourcesModule
    private var sourceHealthMonitor: SourceHealthMonitor
    private var autoMatchScheduler: AutoMatchScheduler? = null

    private var apiRoutesDependencies: MutableStateFlow<ApiDynamicDependencies>

    private val yaml = Yaml(
        configuration = YamlConfiguration(
            encodeDefaults = false,
            strictMode = false
        )
    )
    private val configWriter = ConfigWriter(yaml)
    private val configLoader = ConfigLoader(yaml)

    init {
        configureSqliteTempDir()

        val config = loadConfig()
        setLogLevel(config)
        appConfig = config

        val httpLogger = KotlinLogging.logger("http.logging")
        val redactingLogger = HttpLoggingInterceptor.Logger { message ->
            val redacted = SENSITIVE_HEADER_REGEX.replace(message) { match ->
                "${match.groupValues[1]}***REDACTED***"
            }
            httpLogger.info { redacted }
        }
        val baseOkHttpClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(HttpLoggingInterceptor(redactingLogger)
                .setLevel(appConfig.httpLogLevel))
            .cache(
                Cache(
                    directory = Path.of(System.getProperty("java.io.tmpdir"))
                        .resolve("komf").createDirectories()
                        .toFile(),
                    maxSize = 50L * 1024L * 1024L // 50 MiB
                )
            )
            .build()

        jsonBase = Json {
            ignoreUnknownKeys = true
            encodeDefaults = false
        }

        ktorBaseClient = HttpClient(OkHttp) {
            engine { preconfigured = baseOkHttpClient }
            expectSuccess = true
            install(UserAgent) { agent = komfUserAgent }
        }

        // Separate client for proxy: no cache, no cookies, does not throw on non-2xx
        val proxyOkHttpClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .cookieJar(okhttp3.CookieJar.NO_COOKIES)
            .addInterceptor(HttpLoggingInterceptor(redactingLogger)
                .setLevel(HttpLoggingInterceptor.Level.BASIC))
            .build()

        ktorProxyClient = HttpClient(OkHttp) {
            engine { preconfigured = proxyOkHttpClient }
            expectSuccess = false
        }

        providersModule = CoreModule(
            config = config.metadataProviders,
            ktor = ktorBaseClient,
            onStateRefresh = this::refreshState,
        )
        notificationsModule = NotificationsModule(config.notifications, ktorBaseClient)
        mangaSourcesModule = MangaSourcesModule(ktorBaseClient)
        sourceHealthMonitor = SourceHealthMonitor(mangaSourcesModule)
        sourceHealthMonitor.start()

        mediaServerModule = MediaServerModule(
            komgaConfig = config.komga,
            databaseConfig = config.database,
            jsonBase = jsonBase,
            ktorBaseClient = ktorBaseClient,
            appriseService = notificationsModule.appriseService,
            discordWebhookService = notificationsModule.discordWebhookService,
            metadataProviders = providersModule.metadataProviders,
            mangaSourcesModule = mangaSourcesModule,
            downloadConfig = config.download,
            autoDownloaderConfig = config.autoDownloader,
        )
        this.apiRoutesDependencies = MutableStateFlow(createApiRoutesDependencies())

        startAutoMatchScheduler(config)

        serverModule = ServerModule(
            serverPort = config.server.port,
            onConfigUpdate = this::refreshState,
            dynamicDependencies = apiRoutesDependencies,
            httpClient = ktorProxyClient,
        )

        serverModule.startServer()
    }

    suspend fun refreshState() {
        reloadMutex.withLock {
            reloadModules(this.appConfig)
        }
    }

    suspend fun refreshState(newConfig: AppConfig) {
        reloadMutex.withLock {
            appConfig = newConfig
            reloadModules(newConfig)
            writeConfig(newConfig)
        }
    }

    private fun reloadModules(config: AppConfig) {
        logger.info { "Reconfiguring application state" }

        val providersModule = CoreModule(
            config = config.metadataProviders,
            ktor = ktorBaseClient,
            onStateRefresh = this::refreshState,
        )
        val notificationsModule = NotificationsModule(config.notifications, ktorBaseClient)
        val mangaSourcesModule = MangaSourcesModule(ktorBaseClient)
        val sourceHealthMonitor = SourceHealthMonitor(mangaSourcesModule)
        sourceHealthMonitor.start()
        val mediaServerModule = MediaServerModule(
            komgaConfig = config.komga,
            databaseConfig = config.database,
            jsonBase = jsonBase,
            ktorBaseClient = ktorBaseClient,
            appriseService = notificationsModule.appriseService,
            discordWebhookService = notificationsModule.discordWebhookService,
            metadataProviders = providersModule.metadataProviders,
            mangaSourcesModule = mangaSourcesModule,
            downloadConfig = config.download,
            autoDownloaderConfig = config.autoDownloader,
        )

        this.close()

        this.providersModule = providersModule
        this.notificationsModule = notificationsModule
        this.mangaSourcesModule = mangaSourcesModule
        this.sourceHealthMonitor = sourceHealthMonitor
        this.mediaServerModule = mediaServerModule
        apiRoutesDependencies.value = createApiRoutesDependencies()

        startAutoMatchScheduler(config)
    }

    private fun createApiRoutesDependencies() = ApiDynamicDependencies(
        config = this.appConfig,
        jobTracker = mediaServerModule.jobTracker,
        jobsRepository = mediaServerModule.jobRepository,
        komgaMediaServerClient = mediaServerModule.komgaClient,
        komgaMetadataServiceProvider = mediaServerModule.komgaMetadataServiceProvider,
        discordService = notificationsModule.discordWebhookService,
        discordRenderer = notificationsModule.discordVelocityRenderer,
        appriseService = notificationsModule.appriseService,
        appriseRenderer = notificationsModule.appriseVelocityRenderer,
        mangaBakaDownloader = providersModule.mangaBakaDatabaseDownloader,
        mangaBakaDbMetadata = providersModule.mangaBakaDbMetadata,
        notificationLogRepository = mediaServerModule.notificationLogRepository,
        mangaSourcesModule = mangaSourcesModule,
        sourceHealthMonitor = sourceHealthMonitor,
        downloadService = mediaServerModule.downloadService,
        autoDownloaderService = mediaServerModule.autoDownloaderService,
    )

    private suspend fun writeConfig(config: AppConfig) {
        withContext(Dispatchers.IO) {
            configPath?.let { path -> configWriter.writeConfig(config, path) }
                ?: configWriter.writeConfigToDefaultPath(config)
        }
    }

    private fun close() {
        autoMatchScheduler?.stop()
        autoMatchScheduler = null
        mediaServerModule.close()
    }

    private fun startAutoMatchScheduler(config: AppConfig) {
        if (config.scheduler.autoMatchEnabled) {
            val scheduler = AutoMatchScheduler(
                metadataServiceProvider = mediaServerModule.komgaMetadataServiceProvider,
                mediaServerClient = mediaServerModule.komgaClient,
                intervalHours = config.scheduler.autoMatchIntervalHours
            )
            scheduler.start()
            autoMatchScheduler = scheduler
        }
    }

    private fun loadConfig(): AppConfig {
        return when {
            configPath == null -> configLoader.default()
            configPath.isDirectory() -> configLoader.loadDirectory(configPath)
            else -> configLoader.loadFile(configPath)
        }
    }

    private fun setLogLevel(config: AppConfig) {
        val rootLogger = LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME) as Logger
        rootLogger.level = Level.valueOf(config.logLevel.uppercase())
    }

    private fun configureSqliteTempDir() {
        runCatching {
            val tempDir = Path.of(System.getProperty("user.home"), ".kometamanga", "tmp")
                .createDirectories()
                .toAbsolutePath()
                .normalize()
            System.setProperty("org.sqlite.tmpdir", tempDir.toString())
        }.onFailure {
            logger.warn(it) { "Failed to configure org.sqlite.tmpdir; using system temp directory" }
        }
    }
}