package snd.komf.sources.mangaworld

import com.fleeksoft.ksoup.Ksoup
import io.ktor.client.HttpClient
import io.ktor.client.statement.bodyAsText
import io.ktor.client.request.get
import io.ktor.client.request.headers
import com.fleeksoft.ksoup.nodes.Document

private const val DEFAULT_BASE_URL = "https://www.mangaworld.mx"

class MangaWorldSourceClient(
    private val ktor: HttpClient,
    private val baseUrl: String = DEFAULT_BASE_URL,
) {
    suspend fun searchManga(query: String, page: Int = 1): Document {
        val html = ktor.get("$baseUrl/archive") {
            url {
                parameters.append("keyword", query)
                parameters.append("page", page.toString())
            }
            headers {
                append("Referer", "$baseUrl/")
            }
        }.bodyAsText()
        return Ksoup.parse(html)
    }

    suspend fun getMangaDetails(mangaUrl: String): Document {
        val url = if (mangaUrl.startsWith("http")) mangaUrl else "$baseUrl$mangaUrl"
        val html = ktor.get(url) {
            headers {
                append("Referer", "$baseUrl/")
            }
        }.bodyAsText()
        return Ksoup.parse(html)
    }

    suspend fun getChapterPages(chapterUrl: String): Document {
        val url = if (chapterUrl.startsWith("http")) chapterUrl else "$baseUrl$chapterUrl"
        // Force list style for all images on one page
        val listUrl = when {
            url.contains("style=list") -> url
            url.contains("style=pages") -> url.replace("style=pages", "style=list")
            url.contains("?") -> "$url&style=list"
            else -> "$url?style=list"
        }
        val html = ktor.get(listUrl) {
            headers {
                append("Referer", "$baseUrl/")
            }
        }.bodyAsText()
        return Ksoup.parse(html)
    }
}
