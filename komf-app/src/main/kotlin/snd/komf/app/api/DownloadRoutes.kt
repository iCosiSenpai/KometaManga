package snd.komf.app.api

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.sse.sse
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import snd.komf.api.sources.KomfDownloadItemStatus
import snd.komf.api.sources.KomfDownloadMoveDirection
import snd.komf.api.sources.KomfDownloadMoveRequestDto
import snd.komf.api.sources.KomfDownloadQueueItemDto
import snd.komf.api.sources.KomfDownloadRequestDto
import snd.komf.api.sources.KomfDownloadStatusDto
import snd.komf.api.sources.KomfDownloadStatsDto
import snd.komf.api.sources.KomfDownloadedChapterDto
import snd.komf.api.sources.KomfDownloadEvent
import snd.komf.api.sources.KomfMangaSourceId
import snd.komf.mediaserver.download.DownloadEvent
import snd.komf.mediaserver.download.DownloadItem
import snd.komf.mediaserver.download.DownloadService
import snd.komf.mediaserver.download.DownloadedChapterRecord
import snd.komf.mediaserver.download.MoveDirection

class DownloadRoutes(
    private val downloadService: Flow<DownloadService>,
    private val json: Json,
) {
    fun registerRoutes(routing: Route) {
        routing.route("/downloads") {

            sse("/events") {
                val service = downloadService.first()
                service.events.collect { event ->
                    val dto = event.toDto()
                    send(io.ktor.sse.ServerSentEvent(
                        data = json.encodeToString(dto),
                        event = dto::class.simpleName,
                    ))
                }
            }

            post {
                val service = downloadService.first()
                val request = call.receive<KomfDownloadRequestDto>()
                val sourceId = snd.komf.sources.MangaSourceId.valueOf(request.sourceId.name)

                val items = service.downloadChapters(
                    sourceId = sourceId,
                    mangaId = request.mangaId,
                    chapterIds = request.chapterIds,
                    libraryPath = request.libraryPath,
                    libraryId = request.libraryId,
                )
                call.respond(HttpStatusCode.Accepted, items.map { it.toDto() })
            }

            get("/status") {
                val service = downloadService.first()
                val status = service.getStatus()
                call.respond(KomfDownloadStatusDto(
                    queueSize = status.queueSize,
                    activeDownloads = status.activeDownloads,
                    completedToday = status.completedToday,
                    failedCount = status.failedCount,
                    paused = status.paused,
                    totalSpeedBps = status.totalSpeedBps,
                    totalEtaSec = status.totalEtaSec,
                ))
            }

            get("/queue") {
                val service = downloadService.first()
                call.respond(service.getQueueItems().map { it.toDto() })
            }

            get("/queue/{id}") {
                val service = downloadService.first()
                val id = call.parameters["id"]
                    ?: throw IllegalArgumentException("id is required")
                val item = service.getQueueItem(id)
                    ?: throw NoSuchElementException("Download item $id not found")
                call.respond(item.toDto())
            }

            delete("/queue/{id}") {
                val service = downloadService.first()
                val id = call.parameters["id"]
                    ?: throw IllegalArgumentException("id is required")
                service.removeQueueItem(id)
                call.respond(HttpStatusCode.NoContent)
            }

            // Per-item controls
            post("/queue/{id}/pause") {
                val service = downloadService.first()
                val id = call.parameters["id"] ?: throw IllegalArgumentException("id is required")
                service.pauseItem(id)
                call.respond(HttpStatusCode.NoContent)
            }

            post("/queue/{id}/resume") {
                val service = downloadService.first()
                val id = call.parameters["id"] ?: throw IllegalArgumentException("id is required")
                service.resumeItem(id)
                call.respond(HttpStatusCode.NoContent)
            }

            post("/queue/{id}/cancel") {
                val service = downloadService.first()
                val id = call.parameters["id"] ?: throw IllegalArgumentException("id is required")
                service.cancelItem(id)
                call.respond(HttpStatusCode.NoContent)
            }

            post("/queue/{id}/retry") {
                val service = downloadService.first()
                val id = call.parameters["id"] ?: throw IllegalArgumentException("id is required")
                service.retryItem(id)
                call.respond(HttpStatusCode.NoContent)
            }

            post("/queue/{id}/move") {
                val service = downloadService.first()
                val id = call.parameters["id"] ?: throw IllegalArgumentException("id is required")
                val body = call.receive<KomfDownloadMoveRequestDto>()
                val direction = when (body.direction) {
                    KomfDownloadMoveDirection.UP -> MoveDirection.UP
                    KomfDownloadMoveDirection.DOWN -> MoveDirection.DOWN
                }
                service.moveItem(id, direction)
                call.respond(HttpStatusCode.NoContent)
            }

            post("/queue/clear-completed") {
                val service = downloadService.first()
                service.clearCompleted()
                call.respond(HttpStatusCode.NoContent)
            }

            post("/queue/clear-errors") {
                val service = downloadService.first()
                service.clearErrors()
                call.respond(HttpStatusCode.NoContent)
            }

            post("/queue/retry-failed") {
                val service = downloadService.first()
                service.retryFailed()
                call.respond(HttpStatusCode.NoContent)
            }

            post("/queue/pause") {
                val service = downloadService.first()
                service.pause()
                call.respond(HttpStatusCode.NoContent)
            }

            post("/queue/resume") {
                val service = downloadService.first()
                service.resume()
                call.respond(HttpStatusCode.NoContent)
            }

            post("/queue/cancel-all") {
                val service = downloadService.first()
                service.cancelAll()
                call.respond(HttpStatusCode.NoContent)
            }

            get("/history") {
                val service = downloadService.first()
                val limit = (call.request.queryParameters["limit"]?.toLongOrNull() ?: 50).coerceIn(1, 500)
                val offset = (call.request.queryParameters["offset"]?.toLongOrNull() ?: 0).coerceAtLeast(0)
                call.respond(service.getDownloadedChapters(limit, offset).map { it.toDto() })
            }

            get("/stats") {
                val service = downloadService.first()
                val stats = service.getDownloadStats()
                call.respond(KomfDownloadStatsDto(
                    totalChapters = stats.totalChapters,
                    totalSizeBytes = stats.totalSizeBytes,
                ))
            }
        }
    }

    private fun DownloadItem.toDto() = KomfDownloadQueueItemDto(
        id = id.value,
        sourceId = KomfMangaSourceId.valueOf(sourceId.name),
        mangaId = mangaId,
        mangaTitle = mangaTitle,
        chapterId = chapterId,
        chapterNumber = chapterNumber,
        status = KomfDownloadItemStatus.valueOf(status.name),
        progress = progress,
        totalPages = totalPages,
        error = error,
        bytesDownloaded = bytesDownloaded,
        speedBps = speedBps,
        etaSec = etaSec,
        pausedAt = pausedAt?.toString(),
        position = position,
        libraryPath = libraryPath,
        libraryId = libraryId,
    )

    private fun DownloadedChapterRecord.toDto() = KomfDownloadedChapterDto(
        id = id.value,
        sourceId = KomfMangaSourceId.valueOf(sourceId.name),
        mangaId = mangaId,
        mangaTitle = mangaTitle,
        chapterId = chapterId,
        chapterNumber = chapterNumber,
        volumeNumber = volumeNumber,
        language = language,
        filePath = filePath,
        fileSize = fileSize,
        pageCount = pageCount,
        downloadedAt = downloadedAt.toString(),
    )

    private fun DownloadEvent.toDto(): KomfDownloadEvent = when (this) {
        is DownloadEvent.QueuedEvent -> KomfDownloadEvent.QueuedEvent(
            itemId = itemId,
            chapterId = chapterId,
            mangaTitle = mangaTitle,
            chapterNumber = chapterNumber,
        )
        is DownloadEvent.DownloadStartedEvent -> KomfDownloadEvent.DownloadStartedEvent(
            itemId = itemId,
            chapterId = chapterId,
            totalPages = totalPages,
        )
        is DownloadEvent.PageDownloadedEvent -> KomfDownloadEvent.PageDownloadedEvent(
            itemId = itemId,
            chapterId = chapterId,
            currentPage = currentPage,
            totalPages = totalPages,
            bytesDownloaded = bytesDownloaded,
            speedBps = speedBps,
            etaSec = etaSec,
        )
        is DownloadEvent.PackagingEvent -> KomfDownloadEvent.PackagingEvent(
            itemId = itemId,
            chapterId = chapterId,
        )
        is DownloadEvent.ImportingEvent -> KomfDownloadEvent.ImportingEvent(
            itemId = itemId,
            chapterId = chapterId,
        )
        is DownloadEvent.CompletedEvent -> KomfDownloadEvent.CompletedEvent(
            itemId = itemId,
            chapterId = chapterId,
            filePath = filePath,
            fileSize = fileSize,
        )
        is DownloadEvent.ErrorEvent -> KomfDownloadEvent.ErrorEvent(
            itemId = itemId,
            chapterId = chapterId,
            errorMessage = errorMessage,
        )
        is DownloadEvent.ItemPausedEvent -> KomfDownloadEvent.ItemPausedEvent(
            itemId = itemId,
            chapterId = chapterId,
        )
        is DownloadEvent.ItemResumedEvent -> KomfDownloadEvent.ItemResumedEvent(
            itemId = itemId,
            chapterId = chapterId,
        )
        is DownloadEvent.ItemCancelledEvent -> KomfDownloadEvent.ItemCancelledEvent(
            itemId = itemId,
            chapterId = chapterId,
        )
        is DownloadEvent.ReorderEvent -> KomfDownloadEvent.ReorderEvent(
            itemId = itemId,
            newPosition = newPosition,
        )
        is DownloadEvent.QueueProgressEvent -> KomfDownloadEvent.QueueProgressEvent(
            completedCount = completedCount,
            totalCount = totalCount,
        )
    }
}
