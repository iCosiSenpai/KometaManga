package snd.komf.mediaserver.download

import snd.komf.mediaserver.repository.DownloadQueueItemQueries
import snd.komf.sources.MangaSourceId
import kotlin.time.Clock
import kotlin.time.Instant

class DownloadQueueRepository(
    private val queries: DownloadQueueItemQueries,
) {
    fun findAll(): List<DownloadItem> {
        return queries.findAll().executeAsList().map { it.toDownloadItem() }
    }

    fun findByStatus(status: DownloadItemStatus): List<DownloadItem> {
        return queries.findByStatus(status).executeAsList().map { it.toDownloadItem() }
    }

    fun get(id: DownloadItemId): DownloadItem? {
        return queries.get(id).executeAsOneOrNull()?.toDownloadItem()
    }

    fun countByStatus(status: DownloadItemStatus): Long {
        return queries.countByStatus(status).executeAsOne()
    }

    fun save(item: DownloadItem) {
        queries.save(
            snd.komf.mediaserver.repository.DownloadQueueItem(
                id = item.id,
                sourceId = item.sourceId,
                mangaId = item.mangaId,
                mangaTitle = item.mangaTitle,
                chapterId = item.chapterId,
                chapterNumber = item.chapterNumber,
                volumeNumber = item.volumeNumber,
                language = item.language,
                status = item.status,
                progress = item.progress?.toLong(),
                totalPages = item.totalPages?.toLong(),
                error = item.error,
                createdAt = item.createdAt,
                updatedAt = item.updatedAt,
            )
        )
    }

    fun updateStatus(id: DownloadItemId, status: DownloadItemStatus, error: String? = null) {
        queries.updateStatus(status, error, Clock.System.now(), id)
    }

    fun updateProgress(id: DownloadItemId, progress: Int, totalPages: Int) {
        queries.updateProgress(progress.toLong(), totalPages.toLong(), Clock.System.now(), id)
    }

    fun delete(id: DownloadItemId) {
        queries.delete(id)
    }

    fun deleteByStatus(status: DownloadItemStatus) {
        queries.deleteByStatus(status)
    }

    fun deleteAll() {
        queries.deleteAll()
    }

    private fun snd.komf.mediaserver.repository.DownloadQueueItem.toDownloadItem() = DownloadItem(
        id = id,
        sourceId = sourceId,
        mangaId = mangaId,
        mangaTitle = mangaTitle,
        chapterId = chapterId,
        chapterNumber = chapterNumber,
        volumeNumber = volumeNumber,
        language = language,
        status = status,
        progress = progress?.toInt(),
        totalPages = totalPages?.toInt(),
        error = error,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )
}
