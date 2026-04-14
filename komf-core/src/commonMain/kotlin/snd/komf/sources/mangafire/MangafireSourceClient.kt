package snd.komf.sources.mangafire

import com.fleeksoft.ksoup.Ksoup
import com.fleeksoft.ksoup.nodes.Document
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.headers
import io.ktor.client.statement.bodyAsText
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

private const val BASE_URL = "https://mangafire.to"

@Serializable
data class MangafireSearchResponse(
    val status: Int = 0,
    val result: MangafireSearchResultData? = null,
)

@Serializable
data class MangafireSearchResultData(
    val count: Int = 0,
    val html: String = "",
    val linkMore: String? = null,
)

class MangafireSourceClient(
    private val ktor: HttpClient,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    suspend fun searchManga(query: String): Document {
        val responseText = ktor.get("$BASE_URL/ajax/manga/search") {
            url {
                parameters.append("q", query)
            }
            headers {
                append("Referer", "$BASE_URL/")
                append("X-Requested-With", "XMLHttpRequest")
            }
        }.bodyAsText()

        val searchResponse = json.decodeFromString<MangafireSearchResponse>(responseText)
        val html = searchResponse.result?.html ?: ""
        return Ksoup.parse(html)
    }

    suspend fun getMangaDetails(mangaUrl: String): Document {
        val url = if (mangaUrl.startsWith("http")) mangaUrl else "$BASE_URL$mangaUrl"
        val html = ktor.get(url) {
            headers {
                append("Referer", "$BASE_URL/")
            }
        }.bodyAsText()
        return Ksoup.parse(html)
    }

    suspend fun getChapterPages(chapterUrl: String): Document {
        val url = if (chapterUrl.startsWith("http")) chapterUrl else "$BASE_URL$chapterUrl"
        val html = ktor.get(url) {
            headers {
                append("Referer", "$BASE_URL/")
            }
        }.bodyAsText()
        return Ksoup.parse(html)
    }
}
