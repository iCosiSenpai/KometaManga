package snd.komf.mediaserver.download

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.flow.SharedFlow
import snd.komf.sources.MangaSource
import snd.komf.sources.MangaSourceId
import snd.komf.sources.MangaSourcesModule
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaSearchResult

private val logger = KotlinLogging.logger {}

class DownloadService(
    private val sourcesModule: MangaSourcesModule,
    private val queueManager: DownloadQueueManager,
    private val downloadedChaptersRepository: DownloadedChaptersRepository,
) {
    val events: SharedFlow<DownloadEvent> get() = queueManager.events

    fun start() {
        queueManager.start()
    }

    suspend fun stop() {
        queueManager.stop()
    }

    // Source operations
    suspend fun searchManga(sourceId: MangaSourceId, query: String, language: String? = null): List<MangaSearchResult> {
        return sourcesModule.getSource(sourceId).searchManga(query, language = language)
    }

    suspend fun getMangaDetails(sourceId: MangaSourceId, mangaId: String) =
        sourcesModule.getSource(sourceId).getMangaDetails(mangaId)

    suspend fun getChapters(sourceId: MangaSourceId, mangaId: String, language: String? = null): List<MangaChapter> {
        return sourcesModule.getSource(sourceId).getChapters(mangaId, language)
    }

    // Download operations
    suspend fun downloadChapters(
        sourceId: MangaSourceId,
        mangaId: String,
        chapterIds: List<String>,
        libraryPath: String? = null,
        libraryId: String? = null,
    ): List<DownloadItem> {
        val source = sourcesModule.getSource(sourceId)
        val manga = source.getMangaDetails(mangaId)
        val allChapters = source.getChapters(mangaId)
        val selectedChapters = allChapters.filter { it.id in chapterIds }

        if (selectedChapters.isEmpty()) {
            throw IllegalArgumentException("No matching chapters found for IDs: $chapterIds")
        }

        logger.info { "Queueing ${selectedChapters.size} chapters of '${manga.title}' from $sourceId" }
        return queueManager.enqueue(sourceId, mangaId, manga.title, selectedChapters, libraryPath, libraryId)
    }

    // Queue operations
    fun getQueueItems() = queueManager.getQueueItems()
    fun getQueueItem(id: String) = queueManager.getQueueItem(DownloadItemId(id))
    fun removeQueueItem(id: String) = queueManager.removeQueueItem(DownloadItemId(id))
    fun clearCompleted() = queueManager.clearCompleted()
    fun clearErrors() = queueManager.clearErrors()
    fun retryFailed() = queueManager.retryFailed()
    fun pause() = queueManager.pause()
    fun resume() = queueManager.resume()
    fun cancelAll() = queueManager.cancelAll()
    fun getStatus() = queueManager.getStatus()

    // History operations
    fun getDownloadedChapters(limit: Long = 50, offset: Long = 0) =
        downloadedChaptersRepository.findAll(limit, offset)

    fun getDownloadedChaptersCount() = downloadedChaptersRepository.countAll()

    fun getDownloadedChaptersByManga(mangaId: String, sourceId: MangaSourceId) =
        downloadedChaptersRepository.findByMangaId(mangaId, sourceId)

    fun getDownloadStats(): DownloadStats {
        return DownloadStats(
            totalChapters = downloadedChaptersRepository.countAll().toInt(),
            totalSizeBytes = downloadedChaptersRepository.totalSize(),
        )
    }
}

data class DownloadStats(
    val totalChapters: Int,
    val totalSizeBytes: Long,
)
