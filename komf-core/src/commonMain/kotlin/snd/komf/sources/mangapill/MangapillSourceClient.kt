package snd.komf.sources.mangapill

import com.fleeksoft.ksoup.Ksoup
import com.fleeksoft.ksoup.nodes.Document
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.headers
import io.ktor.client.statement.bodyAsText

private const val BASE_URL = "https://mangapill.com"

class MangapillSourceClient(
    private val ktor: HttpClient,
) {
    suspend fun searchManga(query: String, page: Int = 1): Document {
        val html = ktor.get("$BASE_URL/search") {
            url {
                parameters.append("q", query)
                parameters.append("page", page.toString())
            }
            headers {
                append("Referer", "$BASE_URL/")
            }
        }.bodyAsText()
        return Ksoup.parse(html, BASE_URL)
    }

    suspend fun getMangaDetails(mangaUrl: String): Document {
        val url = if (mangaUrl.startsWith("http")) mangaUrl else "$BASE_URL$mangaUrl"
        val html = ktor.get(url) {
            headers {
                append("Referer", "$BASE_URL/")
            }
        }.bodyAsText()
        return Ksoup.parse(html, BASE_URL)
    }

    suspend fun getChapterPages(chapterUrl: String): Document {
        val url = if (chapterUrl.startsWith("http")) chapterUrl else "$BASE_URL$chapterUrl"
        val html = ktor.get(url) {
            headers {
                append("Referer", "$BASE_URL/")
            }
        }.bodyAsText()
        return Ksoup.parse(html, BASE_URL)
    }
}
