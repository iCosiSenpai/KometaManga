package snd.komf.mediaserver.download

import kotlinx.serialization.Serializable

@Serializable
data class DownloadTarget(
    val id: String,
    val name: String,
    val containerPath: String,
    val komgaLibraryId: String? = null,
    val komgaLibraryPath: String? = null,
)

@Serializable
data class DownloadConfig(
    val downloadDir: String = "/data",
    val komgaLibraryId: String? = null,
    val komgaLibraryPath: String? = null,
    val autoScanAfterDownload: Boolean = true,
    val cbzCompression: Boolean = false,
    val concurrentPageDownloads: Int = 5,
    val extraTargets: List<DownloadTarget> = emptyList(),
)

@Serializable
data class AutoDownloaderConfig(
    val enabled: Boolean = false,
    val intervalHours: Int = 6,
    val notifyOnNewChapters: Boolean = true,
)
