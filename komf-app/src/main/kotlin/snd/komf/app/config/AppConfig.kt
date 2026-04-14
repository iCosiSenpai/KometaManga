package snd.komf.app.config

import kotlinx.serialization.Serializable
import okhttp3.logging.HttpLoggingInterceptor
import okhttp3.logging.HttpLoggingInterceptor.Level.BASIC
import snd.komf.mediaserver.config.DatabaseConfig
import snd.komf.mediaserver.config.KomgaConfig
import snd.komf.mediaserver.download.AutoDownloaderConfig
import snd.komf.mediaserver.download.DownloadConfig
import snd.komf.notifications.NotificationsConfig
import snd.komf.providers.MetadataProvidersConfig

@Serializable
data class AppConfig(
    val komga: KomgaConfig = KomgaConfig(),
    val database: DatabaseConfig = DatabaseConfig(),
    val metadataProviders: MetadataProvidersConfig = MetadataProvidersConfig(),
    val notifications: NotificationsConfig = NotificationsConfig(),
    val server: ServerConfig = ServerConfig(),
    val scheduler: SchedulerConfig = SchedulerConfig(),
    val download: DownloadConfig = DownloadConfig(),
    val autoDownloader: AutoDownloaderConfig = AutoDownloaderConfig(),
    val auth: AuthConfig = AuthConfig(),
    val logLevel: String = "INFO",
    val httpLogLevel: HttpLoggingInterceptor.Level = BASIC
)

@Serializable
data class ServerConfig(
    val port: Int = 8085
)

@Serializable
data class SchedulerConfig(
    val autoMatchEnabled: Boolean = false,
    val autoMatchIntervalHours: Int = 24
)

@Serializable
data class AuthConfig(
    val username: String = "",
    val passwordHash: String = "",
    val sessionSecret: String = "",
)