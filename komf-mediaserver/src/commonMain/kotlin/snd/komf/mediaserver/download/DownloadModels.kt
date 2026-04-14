package snd.komf.mediaserver.download

import snd.komf.sources.MangaSourceId
import kotlin.time.Instant
import java.util.UUID

@JvmInline
value class DownloadItemId(val value: String) {
    companion object {
        fun generate(): DownloadItemId = DownloadItemId(UUID.randomUUID().toString())
    }
}

@JvmInline
value class DownloadedChapterId(val value: String) {
    companion object {
        fun generate(): DownloadedChapterId = DownloadedChapterId(UUID.randomUUID().toString())
    }
}

enum class DownloadItemStatus {
    QUEUED,
    DOWNLOADING,
    PACKAGING,
    IMPORTING,
    COMPLETED,
    ERROR,
}

data class DownloadItem(
    val id: DownloadItemId,
    val sourceId: MangaSourceId,
    val mangaId: String,
    val mangaTitle: String,
    val chapterId: String,
    val chapterNumber: String,
    val volumeNumber: String? = null,
    val language: String? = null,
    val libraryPath: String? = null,
    val libraryId: String? = null,
    val status: DownloadItemStatus = DownloadItemStatus.QUEUED,
    val progress: Int? = null,
    val totalPages: Int? = null,
    val error: String? = null,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class DownloadedChapterRecord(
    val id: DownloadedChapterId,
    val sourceId: MangaSourceId,
    val mangaId: String,
    val mangaTitle: String,
    val chapterId: String,
    val chapterNumber: String,
    val volumeNumber: String? = null,
    val language: String? = null,
    val filePath: String,
    val fileSize: Long,
    val pageCount: Int,
    val downloadedAt: Instant,
)
