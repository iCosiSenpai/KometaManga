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
        val bytesDownloaded: Long,
        val speedBps: Long? = null,
        val etaSec: Long? = null,
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
    @SerialName("ItemPausedEvent")
    data class ItemPausedEvent(
        val itemId: String,
        val chapterId: String,
    ) : DownloadEvent

    @Serializable
    @SerialName("ItemResumedEvent")
    data class ItemResumedEvent(
        val itemId: String,
        val chapterId: String,
    ) : DownloadEvent

    @Serializable
    @SerialName("ItemCancelledEvent")
    data class ItemCancelledEvent(
        val itemId: String,
        val chapterId: String,
    ) : DownloadEvent

    @Serializable
    @SerialName("ReorderEvent")
    data class ReorderEvent(
        val itemId: String,
        val newPosition: Int,
    ) : DownloadEvent

    @Serializable
    @SerialName("QueueProgressEvent")
    data class QueueProgressEvent(
        val completedCount: Int,
        val totalCount: Int,
    ) : DownloadEvent
}
