package snd.komf.api.sources

import kotlinx.serialization.Serializable

@Serializable
data class KomfDownloadRequestDto(
    val sourceId: KomfMangaSourceId,
    val mangaId: String,
    val chapterIds: List<String>,
    val libraryPath: String? = null,
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
)

@Serializable
enum class KomfDownloadItemStatus {
    QUEUED,
    DOWNLOADING,
    PACKAGING,
    IMPORTING,
    COMPLETED,
    ERROR,
}

@Serializable
data class KomfDownloadStatusDto(
    val queueSize: Int,
    val activeDownloads: Int,
    val completedToday: Int,
    val failedCount: Int,
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
data class KomfDownloadStatsDto(
    val totalChapters: Int,
    val totalSizeBytes: Long,
)
