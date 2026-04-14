package snd.komf.api.sources

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
sealed interface KomfDownloadEvent {

    @Serializable
    @SerialName("QueuedEvent")
    data class QueuedEvent(
        val chapterId: String,
        val mangaTitle: String,
        val chapterNumber: String,
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("DownloadStartedEvent")
    data class DownloadStartedEvent(
        val chapterId: String,
        val totalPages: Int,
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("PageDownloadedEvent")
    data class PageDownloadedEvent(
        val chapterId: String,
        val currentPage: Int,
        val totalPages: Int,
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("PackagingEvent")
    data class PackagingEvent(
        val chapterId: String,
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("CompletedEvent")
    data class CompletedEvent(
        val chapterId: String,
        val filePath: String,
        val fileSize: Long,
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("ErrorEvent")
    data class ErrorEvent(
        val chapterId: String,
        val errorMessage: String,
    ) : KomfDownloadEvent

    @Serializable
    @SerialName("QueueProgressEvent")
    data class QueueProgressEvent(
        val completedCount: Int,
        val totalCount: Int,
    ) : KomfDownloadEvent
}
