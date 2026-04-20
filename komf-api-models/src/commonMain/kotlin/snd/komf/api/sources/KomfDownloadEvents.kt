package snd.komf.api.sources

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
sealed interface KomfDownloadEvent {

    @Serializable
    @SerialName("QueuedEvent")
    data class QueuedEvent(
        val itemId: String,
        val chapterId: String,
        val mangaTitle: String,
        val chapterNumber: String,
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("DownloadStartedEvent")
    data class DownloadStartedEvent(
        val itemId: String,
        val chapterId: String,
        val totalPages: Int,
    ) : KomfDownloadEvent

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
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("PackagingEvent")
    data class PackagingEvent(
        val itemId: String,
        val chapterId: String,
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("ImportingEvent")
    data class ImportingEvent(
        val itemId: String,
        val chapterId: String,
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("CompletedEvent")
    data class CompletedEvent(
        val itemId: String,
        val chapterId: String,
        val filePath: String,
        val fileSize: Long,
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("ErrorEvent")
    data class ErrorEvent(
        val itemId: String,
        val chapterId: String,
        val errorMessage: String,
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("ItemPausedEvent")
    data class ItemPausedEvent(
        val itemId: String,
        val chapterId: String,
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("ItemResumedEvent")
    data class ItemResumedEvent(
        val itemId: String,
        val chapterId: String,
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("ItemCancelledEvent")
    data class ItemCancelledEvent(
        val itemId: String,
        val chapterId: String,
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("ReorderEvent")
    data class ReorderEvent(
        val itemId: String,
        val newPosition: Int,
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("QueueProgressEvent")
    data class QueueProgressEvent(
        val completedCount: Int,
        val totalCount: Int,
    ) : KomfDownloadEvent
}
