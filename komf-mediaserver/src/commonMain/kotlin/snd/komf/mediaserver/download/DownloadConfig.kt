package snd.komf.mediaserver.download

import kotlinx.serialization.Serializable

@Serializable
data class DownloadConfig(
    val downloadDir: String = "./downloads",
    val komgaLibraryId: String? = null,
    val komgaLibraryPath: String? = null,
    val autoScanAfterDownload: Boolean = true,
    val cbzCompression: Boolean = false,
    val concurrentPageDownloads: Int = 5,
)

@Serializable
data class AutoDownloaderConfig(
    val enabled: Boolean = false,
    val intervalHours: Int = 6,
    val notifyOnNewChapters: Boolean = true,
)
