package snd.komf.app.api

import io.ktor.client.plugins.ResponseException
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import snd.komf.api.mediaserver.KomfMediaServerConnectionResponse
import snd.komf.api.mediaserver.KomfMediaServerLibrary
import snd.komf.api.mediaserver.KomfMediaServerLibraryId
import snd.komf.api.mediaserver.KomfMediaServerSeries
import snd.komf.mediaserver.MediaServerClient
import snd.komf.mediaserver.model.MediaServerLibraryId

class MediaServerRoutes(
    private val mediaServerClient: Flow<MediaServerClient>,
) {

    fun registerRoutes(routing: Route) {
        routing.route("/media-server") {
            checkConnectionRoute()
            getLibrariesRoute()
            getSeriesRoute()
        }
    }

    private fun Route.checkConnectionRoute() {
        get("/connected") {
            try {
                mediaServerClient.first().getLibraries()
                call.respond(
                    HttpStatusCode.OK,
                    KomfMediaServerConnectionResponse(
                        success = true,
                        httpStatusCode = HttpStatusCode.OK.value,
                        errorMessage = null
                    )
                )
            } catch (exception: ResponseException) {
                call.respond(
                    HttpStatusCode.OK,
                    KomfMediaServerConnectionResponse(
                        success = false,
                        httpStatusCode = exception.response.status.value,
                        errorMessage = HttpStatusCode.fromValue(exception.response.status.value).description
                    )
                )
            } catch (exception: Exception) {
                call.respond(
                    HttpStatusCode.OK,
                    KomfMediaServerConnectionResponse(
                        success = false,
                        httpStatusCode = null,
                        errorMessage =
                            buildString {
                                exception.message?.let { append(it) }
                                exception.cause?.message?.let { append("; $it") }
                            }
                    )
                )

            }
        }
    }

    private fun Route.getLibrariesRoute() {
        get("/libraries") {
            val libraries = mediaServerClient.first().getLibraries().map {
                KomfMediaServerLibrary(
                    id = KomfMediaServerLibraryId(it.id.value),
                    name = it.name,
                    roots = it.roots
                )
            }
            call.respond(HttpStatusCode.OK, libraries)
        }
    }

    private fun Route.getSeriesRoute() {
        get("/libraries/{libraryId}/series") {
            val libraryId = call.parameters["libraryId"]
                ?: return@get call.respond(HttpStatusCode.BadRequest, "Missing libraryId")
            val query = call.request.queryParameters["query"]?.lowercase()

            val allSeries = mutableListOf<KomfMediaServerSeries>()
            var page = 1
            while (true) {
                val result = mediaServerClient.first()
                    .getSeries(MediaServerLibraryId(libraryId), page)
                allSeries.addAll(result.content.map {
                    KomfMediaServerSeries(
                        id = it.id.value,
                        libraryId = it.libraryId.value,
                        name = it.name,
                        booksCount = it.booksCount,
                    )
                })
                if (page >= (result.totalPages ?: 1)) break
                page++
            }

            val filtered = if (query.isNullOrBlank()) allSeries
            else allSeries.filter { it.name.lowercase().contains(query) }

            call.respond(HttpStatusCode.OK, filtered.sortedBy { it.name })
        }
    }
}