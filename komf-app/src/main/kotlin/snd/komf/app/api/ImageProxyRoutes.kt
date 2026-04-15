package snd.komf.app.api

import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsChannel
import io.ktor.http.CacheControl
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.cacheControl
import io.ktor.server.response.respond
import io.ktor.server.response.respondBytesWriter
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.utils.io.copyTo
import java.net.URI

private val ALLOWED_HOSTS = setOf(
    "uploads.mangadex.org",
    "meo.comick.pictures",
    "comicknew.pictures",
    "mangapill.com",
    "cdn.readdetectiveconan.com",
    "cdn.mangapill.com",
    "weebcentral.com",
    "temp.compsci88.com",
    "official.lowee.us",
    "scansmangas.me",
    "avt.mkklcdnv6temp.com",
    "mangaworld.ac",
    "mangaworld.so",
    "mangaworld.mx",
    "www.mangaworld.mx",
    "img.ninemanga.com",
    "static.mfcdn.nl",
    "s.mfcdn.nl",
    "mangafire.to",
    "cdn.mangafire.to",
)

private fun isComickImageHost(host: String): Boolean {
    return host == "meo.comick.pictures" || host == "comicknew.pictures" || host.endsWith(".comicknew.pictures")
}

class ImageProxyRoutes(
    private val httpClient: HttpClient,
) {
    fun registerRoutes(routing: Route) {
        routing.get("/image-proxy") {
            val url = call.request.queryParameters["url"]
            if (url.isNullOrBlank()) {
                call.respond(HttpStatusCode.BadRequest, "Missing 'url' parameter")
                return@get
            }

            val parsed = try {
                URI(url)
            } catch (_: Exception) {
                call.respond(HttpStatusCode.BadRequest, "Invalid URL")
                return@get
            }

            val host = parsed.host?.lowercase()
            if (host == null || ALLOWED_HOSTS.none { host == it || host.endsWith(".$it") }) {
                call.respond(HttpStatusCode.Forbidden, "Host not allowed")
                return@get
            }

            if (parsed.scheme != "https" && parsed.scheme != "http") {
                call.respond(HttpStatusCode.BadRequest, "Only HTTP(S) URLs allowed")
                return@get
            }

            val response = httpClient.get(url) {
                header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                header("Referer", if (isComickImageHost(host)) "https://comick.art/" else "${parsed.scheme}://${parsed.host}/")
            }

            val contentType = response.headers["Content-Type"]
                ?.let { ContentType.parse(it) }
                ?: ContentType.Image.Any

            call.response.cacheControl(CacheControl.MaxAge(maxAgeSeconds = 3600))
            call.respondBytesWriter(contentType = contentType, status = response.status) {
                response.bodyAsChannel().copyTo(this)
            }
        }
    }
}
