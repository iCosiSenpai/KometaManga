package snd.komf.app.api

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import snd.komf.api.sources.KomfAutoDownloaderRuleDto
import snd.komf.api.sources.KomfAutoDownloaderStatusDto
import snd.komf.api.sources.KomfCreateAutoDownloaderRuleDto
import snd.komf.api.sources.KomfMangaSourceId
import snd.komf.api.sources.KomfUpdateAutoDownloaderRuleDto
import snd.komf.mediaserver.download.auto.AutoDownloaderRuleRecord
import snd.komf.mediaserver.download.auto.AutoDownloaderService
import snd.komf.sources.MangaSourceId

class AutoDownloaderRoutes(
    private val autoDownloaderService: Flow<AutoDownloaderService>,
) {
    fun registerRoutes(routing: Route) {
        routing.route("/auto-downloader") {

            get("/status") {
                val service = autoDownloaderService.first()
                val status = service.getStatus()
                call.respond(KomfAutoDownloaderStatusDto(
                    enabled = status.enabled,
                    lastCheck = status.lastCheck?.toString(),
                    nextCheck = status.nextCheck?.toString(),
                    activeRulesCount = status.activeRulesCount,
                ))
            }

            post("/check-now") {
                val service = autoDownloaderService.first()
                service.checkNow()
                call.respond(HttpStatusCode.NoContent)
            }

            // Rules CRUD
            route("/rules") {
                get {
                    val service = autoDownloaderService.first()
                    call.respond(service.getRules().map { it.toDto() })
                }

                post {
                    val service = autoDownloaderService.first()
                    val request = call.receive<KomfCreateAutoDownloaderRuleDto>()
                    val rule = service.createRule(
                        sourceId = MangaSourceId.valueOf(request.sourceId.name),
                        mangaId = request.mangaId,
                        mangaTitle = request.mangaTitle,
                        language = request.language,
                        scanlator = request.scanlator,
                        lastChapterNumber = request.lastChapterNumber,
                        enabled = request.enabled,
                        komgaLibraryId = request.komgaLibraryId,
                        komgaLibraryPath = request.komgaLibraryPath,
                    )
                    call.respond(HttpStatusCode.Created, rule.toDto())
                }

                get("/{id}") {
                    val service = autoDownloaderService.first()
                    val id = call.parameters["id"]
                        ?: throw IllegalArgumentException("id is required")
                    val rule = service.getRule(id)
                        ?: throw NoSuchElementException("Rule $id not found")
                    call.respond(rule.toDto())
                }

                patch("/{id}") {
                    val service = autoDownloaderService.first()
                    val id = call.parameters["id"]
                        ?: throw IllegalArgumentException("id is required")
                    val request = call.receive<KomfUpdateAutoDownloaderRuleDto>()
                    val updated = service.updateRule(
                        id = id,
                        language = request.language,
                        scanlator = request.scanlator,
                        lastChapterNumber = request.lastChapterNumber,
                        enabled = request.enabled,
                        komgaLibraryId = request.komgaLibraryId,
                        komgaLibraryPath = request.komgaLibraryPath,
                    )
                    call.respond(updated.toDto())
                }

                delete("/{id}") {
                    val service = autoDownloaderService.first()
                    val id = call.parameters["id"]
                        ?: throw IllegalArgumentException("id is required")
                    service.deleteRule(id)
                    call.respond(HttpStatusCode.NoContent)
                }
            }
        }
    }

    private fun AutoDownloaderRuleRecord.toDto() = KomfAutoDownloaderRuleDto(
        id = id.value,
        sourceId = KomfMangaSourceId.valueOf(sourceId.name),
        mangaId = mangaId,
        mangaTitle = mangaTitle,
        language = language,
        scanlator = scanlator,
        lastChapterNumber = lastChapterNumber,
        enabled = enabled,
        komgaLibraryId = komgaLibraryId,
        komgaLibraryPath = komgaLibraryPath,
    )
}
