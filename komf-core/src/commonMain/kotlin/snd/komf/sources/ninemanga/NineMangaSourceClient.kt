package snd.komf.sources.ninemanga

import com.fleeksoft.ksoup.Ksoup
import com.fleeksoft.ksoup.nodes.Document
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.statement.bodyAsText

class NineMangaSourceClient(
    private val ktor: HttpClient,
    private val baseUrl: String,
) {
    // WeebCentral search is a GET against /search/data with HTMX-style parameters.
    suspend fun searchManga(query: String): Document {
        val html = ktor.get("$baseUrl/search/data") {
            parameter("text", query)
            parameter("limit", "32")
            parameter("offset", "0")
            parameter("display_mode", "Full Display")
            parameter("sort_by", "Best Match")
            parameter("order", "Descending")
            parameter("official", "Any")
            parameter("anime", "Any")
            parameter("adult", "Any")
            header("Referer", "$baseUrl/search")
            header("HX-Request", "true")
        }.bodyAsText()
        return Ksoup.parse(html, baseUrl)
    }

    suspend fun getMangaDetails(mangaUrl: String): Document {
        val url = if (mangaUrl.startsWith("http")) mangaUrl else "$baseUrl$mangaUrl"
        val html = ktor.get(url) {
            header("Referer", "$baseUrl/")
        }.bodyAsText()
        return Ksoup.parse(html, baseUrl)
    }

    suspend fun getChapterList(mangaUrl: String): Document {
        // WeebCentral exposes the full chapter list at <seriesUrl>/full-chapter-list
        val seriesUrl = if (mangaUrl.startsWith("http")) mangaUrl else "$baseUrl$mangaUrl"
        // Some series URLs include a trailing slug segment; the /full-chapter-list endpoint
        // lives one level up (e.g. /series/<id>/full-chapter-list). Strip a trailing slug
        // only if the remaining path still starts with /series/.
        val base = seriesUrl.trimEnd('/')
        val candidate = base.substringBeforeLast('/')
        val listUrl = when {
            candidate.contains("/series/") && candidate.substringAfter("/series/").contains('/').not() ->
                "$candidate/full-chapter-list"
            else -> "$base/full-chapter-list"
        }
        val html = ktor.get(listUrl) {
            header("Referer", seriesUrl)
            header("HX-Request", "true")
        }.bodyAsText()
        return Ksoup.parse(html, baseUrl)
    }

    suspend fun getChapterPages(chapterUrl: String): Document {
        val url = if (chapterUrl.startsWith("http")) chapterUrl else "$baseUrl$chapterUrl"
        val html = ktor.get("$url/images") {
            parameter("is_prev", "False")
            parameter("current_page", "1")
            parameter("reading_style", "long_strip")
            header("Referer", url)
            header("HX-Request", "true")
        }.bodyAsText()
        return Ksoup.parse(html, baseUrl)
    }
}
