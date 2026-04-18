package snd.komf.app.api

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import snd.komf.api.sources.KomfHealthStatus
import snd.komf.api.sources.KomfMangaChapterDto
import snd.komf.api.sources.KomfMangaDetailsDto
import snd.komf.api.sources.KomfMangaSearchResultDto
import snd.komf.api.sources.KomfMangaSourceDto
import snd.komf.api.sources.KomfMangaSourceId
import snd.komf.api.sources.KomfMangaStatus
import snd.komf.api.sources.KomfSourceHealthDto
import snd.komf.sources.MangaSourceId
import snd.komf.sources.MangaSourcesModule
import snd.komf.sources.SourceHealthMonitor
import snd.komf.sources.model.HealthStatus
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaDetails
import snd.komf.sources.model.MangaSearchResult
import snd.komf.sources.model.MangaStatus

class SourceRoutes(
    private val sourcesModule: Flow<MangaSourcesModule>,
    private val healthMonitor: Flow<SourceHealthMonitor>,
) {
    private val logger = KotlinLogging.logger {}

    fun registerRoutes(routing: Route) {
        routing.route("/sources") {
            get {
                val module = sourcesModule.first()
                val sources = module.getAllSources().map { (id, source) ->
                    KomfMangaSourceDto(
                        sourceId = KomfMangaSourceId.valueOf(id.name),
                        name = source.sourceName(),
                        languages = source.supportedLanguages(),
                        enabled = true,
                    )
                }
                call.respond(sources)
            }

            get("/health") {
                val monitor = healthMonitor.first()
                val health = monitor.getHealthStatus().map { (sourceId, status) ->
                    KomfSourceHealthDto(
                        sourceId = KomfMangaSourceId.valueOf(sourceId.name),
                        status = status.status.toApiStatus(),
                        latencyMs = status.latencyMs,
                        error = status.error,
                        checkedAt = status.checkedAt?.toString(),
                    )
                }
                call.respond(health)
            }

            post("/health/refresh") {
                val monitor = healthMonitor.first()
                val module = sourcesModule.first()
                val results = mutableListOf<KomfSourceHealthDto>()
                for ((sourceId, _) in module.getAllSources()) {
                    try {
                        val status = monitor.checkSource(sourceId)
                        results.add(
                            KomfSourceHealthDto(
                                sourceId = KomfMangaSourceId.valueOf(sourceId.name),
                                status = status.status.toApiStatus(),
                                latencyMs = status.latencyMs,
                                error = status.error,
                                checkedAt = status.checkedAt?.toString(),
                            )
                        )
                    } catch (e: Exception) {
                        logger.error(e) { "Health refresh failed for source $sourceId" }
                    }
                }
                call.respond(results)
            }

            route("/{sourceId}") {
                get("/search") {
                    val sourceId = call.parameters["sourceId"]?.let { MangaSourceId.valueOf(it) }
                        ?: throw IllegalArgumentException("sourceId is required")
                    val query = (call.request.queryParameters["query"]
                        ?: throw IllegalArgumentException("query parameter is required"))
                        .take(500).trim()
                    val limit = (call.request.queryParameters["limit"]?.toIntOrNull() ?: 20).coerceIn(1, 100)
                    val language = call.request.queryParameters["language"]

                    try {
                        val module = sourcesModule.first()
                        val results = module.getSource(sourceId).searchManga(query, limit, language)
                        call.respond(results.map { it.toDto() })
                    } catch (e: Exception) {
                        logger.error(e) { "Search failed for source $sourceId, query='$query'" }
                        call.respond(
                            HttpStatusCode.BadGateway,
                            mapOf("message" to (e.message ?: "Search failed for source $sourceId"))
                        )
                    }
                }

                get("/manga/{mangaId}") {
                    val sourceId = call.parameters["sourceId"]?.let { MangaSourceId.valueOf(it) }
                        ?: throw IllegalArgumentException("sourceId is required")
                    val mangaId = call.parameters["mangaId"]
                        ?: throw IllegalArgumentException("mangaId is required")

                    try {
                        val module = sourcesModule.first()
                        val details = module.getSource(sourceId).getMangaDetails(mangaId)
                        call.respond(details.toDto())
                    } catch (e: Exception) {
                        logger.error(e) { "Details failed for source $sourceId, mangaId='$mangaId'" }
                        call.respond(
                            HttpStatusCode.BadGateway,
                            mapOf("message" to (e.message ?: "Failed to load manga details from $sourceId"))
                        )
                    }
                }

                get("/manga/{mangaId}/chapters") {
                    val sourceId = call.parameters["sourceId"]?.let { MangaSourceId.valueOf(it) }
                        ?: throw IllegalArgumentException("sourceId is required")
                    val mangaId = call.parameters["mangaId"]
                        ?: throw IllegalArgumentException("mangaId is required")
                    val language = call.request.queryParameters["language"]

                    try {
                        val module = sourcesModule.first()
                        val chapters = module.getSource(sourceId).getChapters(mangaId, language)
                        call.respond(chapters.map { it.toDto() })
                    } catch (e: Exception) {
                        logger.error(e) { "Chapters failed for source $sourceId, mangaId='$mangaId'" }
                        call.respond(
                            HttpStatusCode.BadGateway,
                            mapOf("message" to (e.message ?: "Failed to load chapters from $sourceId"))
                        )
                    }
                }
            }
        }
    }

    private fun MangaSearchResult.toDto() = KomfMangaSearchResultDto(
        id = id,
        title = title,
        alternativeTitles = alternativeTitles,
        coverUrl = coverUrl,
        year = year,
        status = status?.toApiStatus(),
        contentRating = contentRating,
        sourceId = KomfMangaSourceId.valueOf(sourceId.name),
    )

    private fun MangaDetails.toDto() = KomfMangaDetailsDto(
        id = id,
        title = title,
        alternativeTitles = alternativeTitles,
        description = description,
        coverUrl = coverUrl,
        status = status?.toApiStatus(),
        year = year,
        authors = authors,
        artists = artists,
        genres = genres,
        tags = tags,
        sourceId = KomfMangaSourceId.valueOf(sourceId.name),
    )

    private fun MangaChapter.toDto() = KomfMangaChapterDto(
        id = id,
        mangaId = mangaId,
        title = title,
        chapterNumber = chapterNumber,
        volumeNumber = volumeNumber,
        language = language,
        scanlator = scanlator,
        updatedAt = updatedAt?.toString(),
        pageCount = pageCount,
        sourceId = KomfMangaSourceId.valueOf(sourceId.name),
    )

    private fun MangaStatus.toApiStatus(): KomfMangaStatus = when (this) {
        MangaStatus.ONGOING -> KomfMangaStatus.ONGOING
        MangaStatus.COMPLETED -> KomfMangaStatus.COMPLETED
        MangaStatus.HIATUS -> KomfMangaStatus.HIATUS
        MangaStatus.CANCELLED -> KomfMangaStatus.CANCELLED
        MangaStatus.UNKNOWN -> KomfMangaStatus.UNKNOWN
    }

    private fun HealthStatus.toApiStatus(): KomfHealthStatus = when (this) {
        HealthStatus.GREEN -> KomfHealthStatus.GREEN
        HealthStatus.YELLOW -> KomfHealthStatus.YELLOW
        HealthStatus.RED -> KomfHealthStatus.RED
    }
}
