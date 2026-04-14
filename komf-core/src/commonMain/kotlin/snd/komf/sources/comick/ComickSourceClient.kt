package snd.komf.sources.comick

import com.fleeksoft.ksoup.Ksoup
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.isSuccess
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import snd.komf.sources.comick.model.ComickBrowseComic
import snd.komf.sources.comick.model.ComickChapterList
import snd.komf.sources.comick.model.ComickPageListData
import snd.komf.sources.comick.model.ComickSearchResponse

private const val API_URL = "https://comick.art"
private const val LEGACY_API_URL = "https://api.comick.dev"
private const val API_ACCEPT_HEADER = "application/json, text/plain, */*"
private const val READER_ACCEPT_HEADER = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"

class ComickSourceClient(
    private val ktor: HttpClient,
    private val json: Json,
) {
    private fun HttpRequestBuilder.applyComickHeaders(accept: String = API_ACCEPT_HEADER) {
        header(HttpHeaders.UserAgent, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        header(HttpHeaders.Accept, accept)
        header(HttpHeaders.Referrer, "https://comick.art/")
        header(HttpHeaders.Origin, "https://comick.art")
        header(HttpHeaders.AcceptLanguage, "en-US,en;q=0.9")
    }

    private suspend inline fun <reified T> getJson(
        url: String,
        block: HttpRequestBuilder.() -> Unit = {},
    ): T {
        val response = ktor.get(url) {
            applyComickHeaders()
            block()
        }
        val cloudflareBlocked = response.headers["Cf-Mitigated"] == "challenge"

        if (cloudflareBlocked || !response.status.isSuccess()) {
            val message = if (cloudflareBlocked) {
                "Comick is temporarily blocked by Cloudflare challenge"
            } else {
                "Comick API returned HTTP ${response.status.value}"
            }
            throw IllegalStateException(message)
        }

        return response.body()
    }

    suspend fun searchManga(
        query: String,
        limit: Int = 20,
    ): List<ComickBrowseComic> {
        val response: ComickSearchResponse = getJson("$API_URL/api/search") {
            parameter("q", query)
            parameter("limit", limit)
            parameter("type", "comic")
        }
        return response.data
    }

    suspend fun getMangaBySlug(slug: String): ComickBrowseComic? {
        val query = slug.replace('-', ' ')
        val response: ComickSearchResponse = getJson("$API_URL/api/search") {
            parameter("q", query)
            parameter("limit", 5)
            parameter("type", "comic")
        }
        return response.data.firstOrNull { it.slug == slug }
            ?: response.data.firstOrNull()
    }

    suspend fun getChapterList(
        slug: String,
        language: String? = null,
        page: Int = 1,
    ): ComickChapterList {
        return getJson("$API_URL/api/comics/$slug/chapter-list") {
            language?.let { parameter("lang", it) }
            parameter("page", page.toString())
        }
    }

    suspend fun getChapterPages(hid: String): ComickPageListData {
        val chapterUrl = when {
            hid.startsWith("https://") || hid.startsWith("http://") -> hid
            hid.startsWith("/comic/") -> "$API_URL$hid"
            else -> {
                return getJson("$LEGACY_API_URL/chapter/$hid") {
                    parameter("tachiyomi", "true")
                }
            }
        }

        val html = ktor.get(chapterUrl) {
            applyComickHeaders(READER_ACCEPT_HEADER)
            header(HttpHeaders.Referrer, chapterUrl)
        }.bodyAsText()

        return parseChapterPagesFromReaderHtml(html, json)
    }
}

internal fun parseChapterPagesFromReaderHtml(html: String, json: Json): ComickPageListData {
    val document = Ksoup.parse(html, API_URL)
    val payload = document.selectFirst("script#sv-data")
        ?.let { script -> script.data().ifBlank { script.html() }.trim() }
        ?.takeIf { it.isNotBlank() }
        ?: throw IllegalStateException("Comick reader page is missing sv-data payload")

    return runCatching {
        json.decodeFromString<ComickPageListData>(payload)
    }.getOrElse { error ->
        throw IllegalStateException("Unable to parse Comick reader payload", error)
    }
}
