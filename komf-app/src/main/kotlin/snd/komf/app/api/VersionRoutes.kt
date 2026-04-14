package snd.komf.app.api

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

private val logger = KotlinLogging.logger {}

class VersionRoutes(
    private val httpClient: HttpClient,
    private val currentVersion: String,
) {
    private val json = Json { ignoreUnknownKeys = true }

    fun registerRoutes(route: Route) {
        route.get("/version") {
            val latestInfo = try {
                fetchLatestRelease()
            } catch (e: Exception) {
                logger.warn(e) { "Failed to check for updates" }
                null
            }

            val latestVersion = latestInfo?.tagName?.removePrefix("v")
            call.respond(
                VersionInfo(
                    current = currentVersion,
                    latest = latestInfo?.tagName,
                    updateAvailable = latestVersion != null && isNewerVersion(latestVersion, currentVersion),
                    releaseUrl = latestInfo?.htmlUrl,
                )
            )
        }
    }

    private fun isNewerVersion(latest: String, current: String): Boolean {
        val latestParts = latest.split(".").mapNotNull { it.toIntOrNull() }
        val currentParts = current.split(".").mapNotNull { it.toIntOrNull() }
        for (i in 0 until maxOf(latestParts.size, currentParts.size)) {
            val l = latestParts.getOrElse(i) { 0 }
            val c = currentParts.getOrElse(i) { 0 }
            if (l > c) return true
            if (l < c) return false
        }
        return false
    }

    private suspend fun fetchLatestRelease(): GitHubRelease? {
        val response = httpClient.get("https://api.github.com/repos/iCosiSenpai/KometaManga/releases/latest") {
            header(HttpHeaders.Accept, "application/vnd.github+json")
            header(HttpHeaders.UserAgent, "KometaManga/$currentVersion")
        }

        if (response.status.value != 200) return null

        val body = response.bodyAsText()
        val obj = json.parseToJsonElement(body).jsonObject

        return GitHubRelease(
            tagName = obj["tag_name"]?.jsonPrimitive?.content ?: return null,
            htmlUrl = obj["html_url"]?.jsonPrimitive?.content ?: "",
        )
    }
}

@Serializable
data class VersionInfo(
    val current: String,
    val latest: String?,
    val updateAvailable: Boolean,
    val releaseUrl: String?,
)

private data class GitHubRelease(
    val tagName: String,
    val htmlUrl: String,
)
