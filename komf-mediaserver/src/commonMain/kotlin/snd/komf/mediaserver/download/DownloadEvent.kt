package snd.komf.mediaserver.download

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
sealed interface DownloadEvent {

    @Serializable
    @SerialName("QueuedEvent")
    data class QueuedEvent(
        val itemId: String,
        val chapterId: String,
        val mangaTitle: String,
        val chapterNumber: String,
    ) : DownloadEvent

    @Serializable
    @SerialName("DownloadStartedEvent")
    data class DownloadStartedEvent(
        val itemId: String,
        val chapterId: String,
        val totalPages: Int,
    ) : DownloadEvent

    @Serializable
    @SerialName("PageDownloadedEvent")
    data class PageDownloadedEvent(
        val itemId: String,
        val chapterId: String,
        val currentPage: Int,
        val totalPages: Int,
    ) : DownloadEvent

    @Serializable
    @SerialName("PackagingEvent")
    data class PackagingEvent(
        val itemId: String,
        val chapterId: String,
    ) : DownloadEvent

    @Serializable
    @SerialName("ImportingEvent")
    data class ImportingEvent(
        val itemId: String,
        val chapterId: String,
    ) : DownloadEvent

    @Serializable
    @SerialName("CompletedEvent")
    data class CompletedEvent(
        val itemId: String,
        val chapterId: String,
        val filePath: String,
        val fileSize: Long,
    ) : DownloadEvent

    @Serializable
    @SerialName("ErrorEvent")
    data class ErrorEvent(
        val itemId: String,
        val chapterId: String,
        val errorMessage: String,
    ) : DownloadEvent

    @Serializable
    @SerialName("QueueProgressEvent")
    data class QueueProgressEvent(
        val completedCount: Int,
        val totalCount: Int,
    ) : DownloadEvent
}
