package snd.komf.mediaserver.download

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import snd.komf.sources.MangaSource
import snd.komf.sources.MangaSourceId
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaDetails
import java.nio.file.Path
import kotlin.time.Clock

private val logger = KotlinLogging.logger {}

class DownloadQueueManager(
    private val queueRepository: DownloadQueueRepository,
    private val downloadedChaptersRepository: DownloadedChaptersRepository,
    private val chapterDownloader: ChapterDownloader,
    private val komgaImporter: KomgaImporter?,
    private val downloadConfig: DownloadConfig,
    private val sourceProvider: (MangaSourceId) -> MangaSource,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val _events = MutableSharedFlow<DownloadEvent>(extraBufferCapacity = 100)
    val events: SharedFlow<DownloadEvent> = _events.asSharedFlow()

    private val processChannel = Channel<Unit>(Channel.CONFLATED)
    private var processingJob: Job? = null

    init {
        // Recover any items that were DOWNLOADING when app crashed
        val staleItems = queueRepository.findByStatus(DownloadItemStatus.DOWNLOADING) +
            queueRepository.findByStatus(DownloadItemStatus.PACKAGING) +
            queueRepository.findByStatus(DownloadItemStatus.IMPORTING)
        for (item in staleItems) {
            queueRepository.updateStatus(item.id, DownloadItemStatus.QUEUED)
        }
    }

    fun start() {
        processingJob = scope.launch {
            for (signal in processChannel) {
                processQueue()
            }
        }
        // Trigger processing if there are queued items
        if (queueRepository.countByStatus(DownloadItemStatus.QUEUED) > 0) {
            processChannel.trySend(Unit)
        }
    }

    suspend fun stop() {
        processingJob?.cancelAndJoin()
        processingJob = null
    }

    fun enqueue(
        sourceId: MangaSourceId,
        mangaId: String,
        mangaTitle: String,
        chapters: List<MangaChapter>,
        libraryPath: String? = null,
        libraryId: String? = null,
    ): List<DownloadItem> {
        val now = Clock.System.now()
        val items = chapters.map { chapter ->
            DownloadItem(
                id = DownloadItemId.generate(),
                sourceId = sourceId,
                mangaId = mangaId,
                mangaTitle = mangaTitle,
                chapterId = chapter.id,
                chapterNumber = chapter.chapterNumber,
                volumeNumber = chapter.volumeNumber,
                language = chapter.language,
                libraryPath = libraryPath,
                libraryId = libraryId,
                status = DownloadItemStatus.QUEUED,
                createdAt = now,
                updatedAt = now,
            )
        }

        for (item in items) {
            queueRepository.save(item)
            _events.tryEmit(
                DownloadEvent.QueuedEvent(
                    itemId = item.id.value,
                    chapterId = item.chapterId,
                    mangaTitle = item.mangaTitle,
                    chapterNumber = item.chapterNumber,
                )
            )
        }

        processChannel.trySend(Unit)
        return items
    }

    fun getQueueItems(): List<DownloadItem> = queueRepository.findAll()

    fun getQueueItem(id: DownloadItemId): DownloadItem? = queueRepository.get(id)

    fun removeQueueItem(id: DownloadItemId) {
        queueRepository.delete(id)
    }

    fun clearCompleted() {
        queueRepository.deleteByStatus(DownloadItemStatus.COMPLETED)
    }

    fun clearErrors() {
        queueRepository.deleteByStatus(DownloadItemStatus.ERROR)
    }

    fun retryFailed() {
        val failed = queueRepository.findByStatus(DownloadItemStatus.ERROR)
        for (item in failed) {
            queueRepository.updateStatus(item.id, DownloadItemStatus.QUEUED)
        }
        if (failed.isNotEmpty()) {
            processChannel.trySend(Unit)
        }
    }

    fun getStatus(): DownloadStatus {
        val queued = queueRepository.countByStatus(DownloadItemStatus.QUEUED)
        val downloading = queueRepository.countByStatus(DownloadItemStatus.DOWNLOADING) +
            queueRepository.countByStatus(DownloadItemStatus.PACKAGING) +
            queueRepository.countByStatus(DownloadItemStatus.IMPORTING)
        val completed = queueRepository.countByStatus(DownloadItemStatus.COMPLETED)
        val failed = queueRepository.countByStatus(DownloadItemStatus.ERROR)

        return DownloadStatus(
            queueSize = queued.toInt(),
            activeDownloads = downloading.toInt(),
            completedToday = completed.toInt(),
            failedCount = failed.toInt(),
        )
    }

    private suspend fun processQueue() {
        while (true) {
            val nextItem = queueRepository.findByStatus(DownloadItemStatus.QUEUED).firstOrNull() ?: break

            try {
                processItem(nextItem)
            } catch (e: Exception) {
                logger.error(e) { "Failed to download ${nextItem.mangaTitle} ch.${nextItem.chapterNumber}" }
                queueRepository.updateStatus(nextItem.id, DownloadItemStatus.ERROR, e.message)
                _events.tryEmit(
                    DownloadEvent.ErrorEvent(
                        itemId = nextItem.id.value,
                        chapterId = nextItem.chapterId,
                        errorMessage = e.message ?: "Unknown error",
                    )
                )
            }

            emitQueueProgress()
        }
    }

    private suspend fun processItem(item: DownloadItem) {
        val source = sourceProvider(item.sourceId)
        val manga = source.getMangaDetails(item.mangaId)

        // Resolve library path: item override > global config
        val effectiveLibraryPath = item.libraryPath ?: downloadConfig.komgaLibraryPath
        val effectiveLibraryId = item.libraryId ?: downloadConfig.komgaLibraryId

        // If library path is set, download directly into the library directory
        // Otherwise fall back to the configured downloadDir
        val outputDir = if (effectiveLibraryPath != null) {
            Path.of(effectiveLibraryPath)
        } else {
            Path.of(downloadConfig.downloadDir)
        }

        // Download phase
        queueRepository.updateStatus(item.id, DownloadItemStatus.DOWNLOADING)
        _events.tryEmit(
            DownloadEvent.DownloadStartedEvent(
                itemId = item.id.value,
                chapterId = item.chapterId,
                totalPages = 0,
            )
        )

        val chapter = MangaChapter(
            id = item.chapterId,
            mangaId = item.mangaId,
            title = null,
            chapterNumber = item.chapterNumber,
            volumeNumber = item.volumeNumber,
            language = item.language,
            sourceId = item.sourceId,
        )

        val result = chapterDownloader.downloadChapter(
            source = source,
            manga = manga,
            chapter = chapter,
            outputDir = outputDir,
            onPageDownloaded = { currentPage, totalPages ->
                queueRepository.updateProgress(item.id, currentPage, totalPages)
                _events.tryEmit(
                    DownloadEvent.PageDownloadedEvent(
                        itemId = item.id.value,
                        chapterId = item.chapterId,
                        currentPage = currentPage,
                        totalPages = totalPages,
                    )
                )
            }
        )

        // Packaging phase
        queueRepository.updateStatus(item.id, DownloadItemStatus.PACKAGING)
        _events.tryEmit(
            DownloadEvent.PackagingEvent(itemId = item.id.value, chapterId = item.chapterId)
        )

        // Import to Komga phase — only if downloaded to a temp dir (not directly to library)
        if (komgaImporter != null && effectiveLibraryPath != null && item.libraryPath == null) {
            // Downloaded to downloadDir, need to copy to library
            queueRepository.updateStatus(item.id, DownloadItemStatus.IMPORTING)
            _events.tryEmit(
                DownloadEvent.ImportingEvent(itemId = item.id.value, chapterId = item.chapterId)
            )
            val importConfig = downloadConfig.copy(
                komgaLibraryPath = effectiveLibraryPath,
                komgaLibraryId = effectiveLibraryId,
            )
            komgaImporter.importToKomga(result.filePath, manga.title, importConfig)
        } else if (komgaImporter != null && effectiveLibraryId != null && downloadConfig.autoScanAfterDownload) {
            // Downloaded directly to library, just trigger scan
            queueRepository.updateStatus(item.id, DownloadItemStatus.IMPORTING)
            _events.tryEmit(
                DownloadEvent.ImportingEvent(itemId = item.id.value, chapterId = item.chapterId)
            )
            try {
                val libId = snd.komf.mediaserver.model.MediaServerLibraryId(effectiveLibraryId)
                komgaImporter.triggerScan(libId)
            } catch (e: Exception) {
                logger.warn(e) { "Failed to trigger Komga scan for library $effectiveLibraryId" }
            }
        }

        // Save download record
        val record = DownloadedChapterRecord(
            id = DownloadedChapterId.generate(),
            sourceId = item.sourceId,
            mangaId = item.mangaId,
            mangaTitle = item.mangaTitle,
            chapterId = item.chapterId,
            chapterNumber = item.chapterNumber,
            volumeNumber = item.volumeNumber,
            language = item.language,
            filePath = result.filePath.toString(),
            fileSize = result.fileSize,
            pageCount = result.pageCount,
            downloadedAt = Clock.System.now(),
        )
        downloadedChaptersRepository.save(record)

        // Mark completed
        queueRepository.updateStatus(item.id, DownloadItemStatus.COMPLETED)
        _events.tryEmit(
            DownloadEvent.CompletedEvent(
                itemId = item.id.value,
                chapterId = item.chapterId,
                filePath = result.filePath.toString(),
                fileSize = result.fileSize,
            )
        )
    }

    private fun emitQueueProgress() {
        val completed = queueRepository.countByStatus(DownloadItemStatus.COMPLETED).toInt()
        val total = queueRepository.findAll().size
        _events.tryEmit(
            DownloadEvent.QueueProgressEvent(
                completedCount = completed,
                totalCount = total,
            )
        )
    }
}

data class DownloadStatus(
    val queueSize: Int,
    val activeDownloads: Int,
    val completedToday: Int,
    val failedCount: Int,
)
