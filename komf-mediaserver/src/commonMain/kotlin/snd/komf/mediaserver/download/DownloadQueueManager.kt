package snd.komf.mediaserver.download

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.CancellationException
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
import java.nio.file.Path
import kotlin.time.Clock

private val logger = KotlinLogging.logger {}

enum class MoveDirection { UP, DOWN }

private class PausedByUser : CancellationException("Paused by user")
private class CancelledByUser : CancellationException("Cancelled by user")

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

    @Volatile private var currentItemId: DownloadItemId? = null
    @Volatile private var pauseRequestedFor: DownloadItemId? = null
    @Volatile private var cancelRequestedFor: DownloadItemId? = null

    @Volatile var paused: Boolean = false
        private set

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
        if (processingJob?.isActive == true) return
        processingJob = scope.launch {
            for (signal in processChannel) {
                processQueue()
            }
        }
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
        var nextPos = queueRepository.maxPosition() + 1
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
                position = nextPos++,
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
        var nextPos = queueRepository.maxPosition() + 1
        for (item in failed) {
            queueRepository.updatePosition(item.id, nextPos++)
            queueRepository.updateStatus(item.id, DownloadItemStatus.QUEUED)
        }
        if (failed.isNotEmpty()) {
            processChannel.trySend(Unit)
        }
    }

    fun pause() {
        paused = true
        logger.info { "Download queue paused" }
    }

    fun resume() {
        paused = false
        logger.info { "Download queue resumed" }
        if (queueRepository.countByStatus(DownloadItemStatus.QUEUED) > 0) {
            processChannel.trySend(Unit)
        }
    }

    fun cancelAll() {
        val queued = queueRepository.findByStatus(DownloadItemStatus.QUEUED)
        for (item in queued) {
            queueRepository.delete(item.id)
        }
        logger.info { "Cancelled ${queued.size} queued downloads" }
    }

    /** Per-item pause: if active, cancels the in-flight job and marks PAUSED; if queued, just marks PAUSED. */
    fun pauseItem(id: DownloadItemId) {
        val item = queueRepository.get(id) ?: return
        when (item.status) {
            DownloadItemStatus.QUEUED -> {
                queueRepository.updatePausedAt(id, Clock.System.now())
                queueRepository.updateStatus(id, DownloadItemStatus.PAUSED)
                _events.tryEmit(DownloadEvent.ItemPausedEvent(id.value, item.chapterId))
            }
            DownloadItemStatus.DOWNLOADING, DownloadItemStatus.PACKAGING, DownloadItemStatus.IMPORTING -> {
                pauseRequestedFor = id
                _events.tryEmit(DownloadEvent.ItemPausedEvent(id.value, item.chapterId))
            }
            else -> { /* nothing to do for completed/error/paused */ }
        }
    }

    /** Resume a paused item: back to QUEUED, trigger processing. */
    fun resumeItem(id: DownloadItemId) {
        val item = queueRepository.get(id) ?: return
        if (item.status != DownloadItemStatus.PAUSED) return
        queueRepository.updatePausedAt(id, null)
        queueRepository.updateStatus(id, DownloadItemStatus.QUEUED)
        _events.tryEmit(DownloadEvent.ItemResumedEvent(id.value, item.chapterId))
        processChannel.trySend(Unit)
    }

    /** Cancel a specific item. If currently active, interrupts; always deletes row. */
    fun cancelItem(id: DownloadItemId) {
        val item = queueRepository.get(id) ?: return
        if (currentItemId == id) {
            cancelRequestedFor = id
        }
        queueRepository.delete(id)
        _events.tryEmit(DownloadEvent.ItemCancelledEvent(id.value, item.chapterId))
    }

    /** Retry a failed item individually. */
    fun retryItem(id: DownloadItemId) {
        val item = queueRepository.get(id) ?: return
        if (item.status != DownloadItemStatus.ERROR) return
        val nextPos = queueRepository.maxPosition() + 1
        queueRepository.updatePosition(id, nextPos)
        queueRepository.updateStatus(id, DownloadItemStatus.QUEUED)
        processChannel.trySend(Unit)
    }

    /** Swap position with the neighbour in the same status bucket (UP = earlier). */
    fun moveItem(id: DownloadItemId, direction: MoveDirection) {
        val item = queueRepository.get(id) ?: return
        // Only reorder items that are in the active/queued pipeline
        val peers = queueRepository.findByStatus(item.status)
            .sortedBy { it.position }
        val index = peers.indexOfFirst { it.id == id }
        if (index < 0) return
        val neighbourIndex = when (direction) {
            MoveDirection.UP -> index - 1
            MoveDirection.DOWN -> index + 1
        }
        if (neighbourIndex !in peers.indices) return
        val neighbour = peers[neighbourIndex]
        val myPos = item.position
        val theirPos = neighbour.position
        queueRepository.updatePosition(item.id, theirPos)
        queueRepository.updatePosition(neighbour.id, myPos)
        _events.tryEmit(DownloadEvent.ReorderEvent(item.id.value, theirPos))
    }

    fun getStatus(): DownloadStatus {
        val queued = queueRepository.countByStatus(DownloadItemStatus.QUEUED)
        val downloading = queueRepository.countByStatus(DownloadItemStatus.DOWNLOADING) +
            queueRepository.countByStatus(DownloadItemStatus.PACKAGING) +
            queueRepository.countByStatus(DownloadItemStatus.IMPORTING)
        val completed = queueRepository.countByStatus(DownloadItemStatus.COMPLETED)
        val failed = queueRepository.countByStatus(DownloadItemStatus.ERROR)

        val active = queueRepository.findByStatus(DownloadItemStatus.DOWNLOADING)
        val totalSpeed = active.sumOf { it.speedBps ?: 0L }
        val maxEta = active.mapNotNull { it.etaSec }.maxOrNull()

        return DownloadStatus(
            queueSize = queued.toInt(),
            activeDownloads = downloading.toInt(),
            completedToday = completed.toInt(),
            failedCount = failed.toInt(),
            paused = paused,
            totalSpeedBps = totalSpeed,
            totalEtaSec = maxEta,
        )
    }

    private suspend fun processQueue() {
        while (true) {
            if (paused) break
            val nextItem = queueRepository.findByStatus(DownloadItemStatus.QUEUED).firstOrNull() ?: break

            currentItemId = nextItem.id
            pauseRequestedFor = null
            cancelRequestedFor = null

            try {
                processItem(nextItem)
            } catch (e: PausedByUser) {
                logger.info { "Paused ${nextItem.mangaTitle} ch.${nextItem.chapterNumber}" }
                queueRepository.updatePausedAt(nextItem.id, Clock.System.now())
                queueRepository.updateStatus(nextItem.id, DownloadItemStatus.PAUSED)
            } catch (e: CancelledByUser) {
                logger.info { "Cancelled ${nextItem.mangaTitle} ch.${nextItem.chapterNumber}" }
                // row already deleted by cancelItem()
            } catch (e: CancellationException) {
                throw e
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
            } finally {
                currentItemId = null
            }

            emitQueueProgress()
        }
    }

    private suspend fun processItem(item: DownloadItem) {
        val source = sourceProvider(item.sourceId)
        val manga = source.getMangaDetails(item.mangaId)

        val effectiveLibraryPath = item.libraryPath ?: downloadConfig.komgaLibraryPath
        val effectiveLibraryId = item.libraryId ?: downloadConfig.komgaLibraryId

        val outputDir = if (effectiveLibraryPath != null) {
            Path.of(effectiveLibraryPath)
        } else {
            Path.of(downloadConfig.downloadDir)
        }

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

        // Speed tracking: sliding window of (timestampMs, bytes) for last ~3s
        val speedWindow = ArrayDeque<Pair<Long, Long>>()
        var cumulativeBytes = 0L
        val startMs = Clock.System.now().toEpochMilliseconds()

        val result = chapterDownloader.downloadChapter(
            source = source,
            manga = manga,
            chapter = chapter,
            outputDir = outputDir,
            onPageDownloaded = { currentPage, totalPages, bytesThisPage ->
                // Check pause/cancel flags — throw to abort
                if (cancelRequestedFor == item.id) throw CancelledByUser()
                if (pauseRequestedFor == item.id || paused) throw PausedByUser()

                cumulativeBytes += bytesThisPage
                val nowMs = Clock.System.now().toEpochMilliseconds()
                speedWindow.addLast(nowMs to bytesThisPage)
                while (speedWindow.isNotEmpty() && nowMs - speedWindow.first().first > 3000) {
                    speedWindow.removeFirst()
                }
                val windowBytes = speedWindow.sumOf { it.second }
                val windowMs = nowMs - (speedWindow.firstOrNull()?.first ?: nowMs)
                val speedBps = if (windowMs > 0) (windowBytes * 1000L) / windowMs else null
                val remaining = (totalPages - currentPage).coerceAtLeast(0)
                val avgBytesPerPage = if (currentPage > 0) cumulativeBytes / currentPage else 0L
                val etaSec = if (speedBps != null && speedBps > 0 && avgBytesPerPage > 0) {
                    (remaining * avgBytesPerPage) / speedBps
                } else null

                queueRepository.updateLiveStats(
                    id = item.id,
                    progress = currentPage,
                    totalPages = totalPages,
                    bytesDownloaded = cumulativeBytes,
                    speedBps = speedBps,
                    etaSec = etaSec,
                )
                _events.tryEmit(
                    DownloadEvent.PageDownloadedEvent(
                        itemId = item.id.value,
                        chapterId = item.chapterId,
                        currentPage = currentPage,
                        totalPages = totalPages,
                        bytesDownloaded = cumulativeBytes,
                        speedBps = speedBps,
                        etaSec = etaSec,
                    )
                )
            }
        )

        queueRepository.updateStatus(item.id, DownloadItemStatus.PACKAGING)
        _events.tryEmit(
            DownloadEvent.PackagingEvent(itemId = item.id.value, chapterId = item.chapterId)
        )

        if (komgaImporter != null && effectiveLibraryPath != null && item.libraryPath == null) {
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

        queueRepository.updateStatus(item.id, DownloadItemStatus.COMPLETED)
        _events.tryEmit(
            DownloadEvent.CompletedEvent(
                itemId = item.id.value,
                chapterId = item.chapterId,
                filePath = result.filePath.toString(),
                fileSize = result.fileSize,
            )
        )

        // unused local kept for future ETA-from-elapsed calc
        @Suppress("UNUSED_VARIABLE") val elapsedMs = Clock.System.now().toEpochMilliseconds() - startMs
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
    val paused: Boolean = false,
    val totalSpeedBps: Long = 0,
    val totalEtaSec: Long? = null,
)
