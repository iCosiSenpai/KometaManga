package snd.komf.app.api

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsChannel
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.URLBuilder
import io.ktor.http.content.OutgoingContent
import io.ktor.http.content.TextContent
import io.ktor.http.contentType
import io.ktor.http.encodedPath
import io.ktor.server.request.contentType
import io.ktor.server.request.httpMethod
import io.ktor.server.request.receive
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.route
import io.ktor.utils.io.ByteReadChannel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import snd.komf.app.config.AppConfig
import java.util.Base64

private val logger = KotlinLogging.logger {}

class KomgaProxyRoutes(
    private val httpClient: HttpClient,
    private val appConfig: Flow<AppConfig>,
) {

    private val hopByHopHeaders = setOf(
        HttpHeaders.Host,
        HttpHeaders.Authorization,
        HttpHeaders.ContentLength,
        HttpHeaders.TransferEncoding,
        HttpHeaders.Connection,
        HttpHeaders.ContentType,
        HttpHeaders.Cookie,
        HttpHeaders.Origin,
    )

    private val skipResponseHeaders = setOf(
        HttpHeaders.TransferEncoding, HttpHeaders.Connection,
        HttpHeaders.ContentLength, HttpHeaders.Server,
        HttpHeaders.SetCookie,
        "X-Frame-Options", "Content-Security-Policy",
        "Cross-Origin-Embedder-Policy", "Cross-Origin-Opener-Policy",
        "Cross-Origin-Resource-Policy",
    )

    fun registerRoutes(routing: Route) {
        // Primary proxy route with HTML rewriting
        routing.route("/komga-proxy/{path...}") {
            handle { proxyToKomga(call, rewriteHtml = true) }
        }

        // Fallback proxy routes: Komga's own API and SSE endpoints.
        // These ensure that even if client-side URL interceptors miss a request,
        // it still reaches Komga instead of falling through to the SPA catch-all.
        for (prefix in listOf("/api/v1", "/sse")) {
            routing.route("$prefix/{path...}") {
                handle {
                    val pathSegments = call.parameters.getAll("path") ?: emptyList()
                    val remainingPath = prefix.removePrefix("/") + "/" + pathSegments.joinToString("/")
                    proxyToKomga(call, rewriteHtml = false, overridePath = remainingPath)
                }
            }
        }
    }

    private suspend fun proxyToKomga(
        call: io.ktor.server.routing.RoutingCall,
        rewriteHtml: Boolean,
        overridePath: String? = null,
    ) {
        val config = appConfig.first()
        val komgaBaseUri = config.komga.baseUri.trimEnd('/')

        if (!komgaBaseUri.startsWith("http://") && !komgaBaseUri.startsWith("https://")) {
            call.respond(HttpStatusCode.BadRequest, "Invalid Komga baseUri scheme. Only http:// and https:// are allowed.")
            return
        }

        val komgaUser = config.komga.komgaUser
        val komgaPassword = config.komga.komgaPassword

        val remainingPath = overridePath
            ?: (call.parameters.getAll("path") ?: emptyList()).joinToString("/")

        val targetUrl = URLBuilder(komgaBaseUri).apply {
            encodedPath = "/$remainingPath"
            call.request.queryParameters.forEach { name, values ->
                values.forEach { parameters.append(name, it) }
            }
        }.buildString()

        logger.debug { "Proxying ${call.request.httpMethod.value} /$remainingPath -> $targetUrl" }

        try {
            val basicAuth = Base64.getEncoder()
                .encodeToString("$komgaUser:$komgaPassword".toByteArray())

            val isWrite = call.request.httpMethod in listOf(
                HttpMethod.Post, HttpMethod.Put, HttpMethod.Patch, HttpMethod.Delete
            )
            val bodyBytes = if (isWrite) call.receive<ByteArray>() else null
            val incomingCt = if (isWrite) call.request.contentType() else null

            val response = httpClient.request(targetUrl) {
                method = call.request.httpMethod
                header(HttpHeaders.Authorization, "Basic $basicAuth")

                for (name in call.request.headers.names()) {
                    if (hopByHopHeaders.any { it.equals(name, ignoreCase = true) }) continue
                    call.request.headers.getAll(name)?.forEach { value ->
                        header(name, value)
                    }
                }

                if (bodyBytes != null) {
                    incomingCt?.let { contentType(it) }
                    setBody(bodyBytes)
                }
            }

            for ((name, values) in response.headers.entries()) {
                if (skipResponseHeaders.any { it.equals(name, ignoreCase = true) }) continue
                for (value in values) {
                    call.response.header(name, value)
                }
            }

            val ct = response.contentType()
            val status = HttpStatusCode.fromValue(response.status.value)

            if (rewriteHtml && ct?.withoutParameters()?.match(io.ktor.http.ContentType.Text.Html) == true) {
                val html = response.bodyAsText()
                call.respond(status, TextContent(rewriteKomgaHtml(html, komgaBaseUri), ct))
                return
            }

            val responseBody = response.bodyAsChannel()
            val contentLength = response.headers[HttpHeaders.ContentLength]?.toLongOrNull()

            call.respond(
                status,
                message = object : OutgoingContent.ReadChannelContent() {
                    override val contentLength = contentLength
                    override val contentType = ct
                    override fun readFrom(): ByteReadChannel = responseBody
                }
            )
        } catch (e: Exception) {
            logger.error(e) { "Proxy request failed: $targetUrl" }
            call.respond(
                HttpStatusCode.BadGateway,
                "Failed to proxy request to Komga"
            )
        }
    }

    private fun rewriteKomgaHtml(html: String, komgaBaseUri: String): String {
        // Rewrite resourceBaseUrl so Komga's Vue Router base, Axios baseURL,
        // and all asset paths automatically use /komga-proxy/ prefix.
        val patched = html
            .replace("window.resourceBaseUrl = '/'", "window.resourceBaseUrl = '/komga-proxy/'")
            .replace("src=\"/", "src=\"/komga-proxy/")
            .replace("href=\"/", "href=\"/komga-proxy/")
            .replace("content=\"/", "content=\"/komga-proxy/")

        // Extract the Komga origin (scheme://host:port) to inject for the URL interceptor.
        val komgaOrigin = try {
            val uri = java.net.URI(komgaBaseUri.trimEnd('/'))
            val port = if (uri.port > 0) ":${uri.port}" else ""
            "${uri.scheme}://${uri.host}$port"
        } catch (_: Exception) { "" }

        // Sanitise before injecting into <script> to prevent XSS from config values
        val safeOrigin = komgaOrigin
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("<", "\\u003c")

        val injection = """
<script>window.KOMETA_BASE=window.location.origin;window.KOMETA_KOMGA_ORIGIN='$safeOrigin';</script>
<script src="/komga-inject.js"></script>
""".trimIndent()

        return if (patched.contains("</head>"))
            patched.replace("</head>", "$injection</head>")
        else
            injection + patched
    }
}
