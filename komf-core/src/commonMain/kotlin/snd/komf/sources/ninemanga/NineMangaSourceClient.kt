package snd.komf.sources.ninemanga

import com.fleeksoft.ksoup.Ksoup
import com.fleeksoft.ksoup.nodes.Document
import io.ktor.client.HttpClient
import io.ktor.client.request.forms.FormDataContent
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.parametersOf

class NineMangaSourceClient(
    private val ktor: HttpClient,
    private val baseUrl: String,
) {
    suspend fun searchManga(query: String): Document {
        val html = ktor.post("$baseUrl/search/simple") {
            parameter("location", "main")
            header("Referer", "$baseUrl/search")
            setBody(FormDataContent(parametersOf("text", query)))
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
        val seriesPath = mangaUrl.substringAfter(baseUrl).substringBeforeLast("/")
        val html = ktor.get("$baseUrl$seriesPath/full-chapter-list") {
            header("Referer", mangaUrl)
        }.bodyAsText()
        return Ksoup.parse(html, baseUrl)
    }

    suspend fun getChapterPages(chapterUrl: String): Document {
        val url = if (chapterUrl.startsWith("http")) chapterUrl else "$baseUrl$chapterUrl"
        val html = ktor.get("$url/images") {
            parameter("is_prev", "False")
            parameter("current_page", 1)
            parameter("reading_style", "long_strip")
            header("Referer", url)
        }.bodyAsText()
        return Ksoup.parse(html, baseUrl)
    }
}
