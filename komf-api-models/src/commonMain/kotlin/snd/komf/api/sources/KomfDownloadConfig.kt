package snd.komf.api.sources

import kotlinx.serialization.Serializable

@Serializable
data class KomfMangaSourceConfigDto(
    val enabled: Boolean = false,
    val priority: Int = 10,
)

@Serializable
data class KomfDownloadConfigDto(
    val downloadDir: String? = null,
    val komgaLibraryId: String? = null,
    val komgaLibraryPath: String? = null,
    val autoScanAfterDownload: Boolean = true,
    val cbzCompression: Boolean = false,
    val concurrentPageDownloads: Int = 5,
    val sources: Map<KomfMangaSourceId, KomfMangaSourceConfigDto> = emptyMap(),
)

@Serializable
data class KomfAutoDownloaderConfigDto(
    val enabled: Boolean = false,
    val intervalHours: Int = 6,
    val notifyOnNewChapters: Boolean = true,
)
