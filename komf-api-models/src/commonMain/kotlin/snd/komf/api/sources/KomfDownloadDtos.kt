package snd.komf.api.sources

import kotlinx.serialization.Serializable

@Serializable
data class KomfDownloadRequestDto(
    val sourceId: KomfMangaSourceId,
    val mangaId: String,
    val chapterIds: List<String>,
    val libraryPath: String? = null,
    val libraryId: String? = null,
)

@Serializable
data class KomfDownloadQueueItemDto(
    val id: String,
    val sourceId: KomfMangaSourceId,
    val mangaId: String,
    val mangaTitle: String,
    val chapterId: String,
    val chapterNumber: String,
    val status: KomfDownloadItemStatus,
    val progress: Int? = null,
    val totalPages: Int? = null,
    val error: String? = null,
    val bytesDownloaded: Long? = null,
    val speedBps: Long? = null,
    val etaSec: Long? = null,
    val pausedAt: String? = null,
    val position: Int = 0,
    val libraryPath: String? = null,
    val libraryId: String? = null,
)

@Serializable
enum class KomfDownloadItemStatus {
    QUEUED,
    DOWNLOADING,
    PACKAGING,
    IMPORTING,
    COMPLETED,
    ERROR,
    PAUSED,
}

@Serializable
data class KomfDownloadStatusDto(
    val queueSize: Int,
    val activeDownloads: Int,
    val completedToday: Int,
    val failedCount: Int,
    val paused: Boolean = false,
    val totalSpeedBps: Long = 0,
    val totalEtaSec: Long? = null,
)

@Serializable
data class KomfDownloadedChapterDto(
    val id: String,
    val sourceId: KomfMangaSourceId,
    val mangaId: String,
    val mangaTitle: String,
    val chapterId: String,
    val chapterNumber: String,
    val volumeNumber: String? = null,
    val language: String? = null,
    val filePath: String,
    val fileSize: Long,
    val pageCount: Int,
    val downloadedAt: String,
)

@Serializable
data class KomfDownloadMoveRequestDto(
    val direction: KomfDownloadMoveDirection,
)

@Serializable
enum class KomfDownloadMoveDirection {
    UP,
    DOWN,
}

@Serializable
data class KomfDownloadStatsDto(
    val totalChapters: Int,
    val totalSizeBytes: Long,
)
