package snd.komf.sources.mangadex

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import snd.komf.providers.mangadex.model.MangaDexManga
import snd.komf.providers.mangadex.model.MangaDexMangaId
import snd.komf.providers.mangadex.model.MangaDexPagedResponse
import snd.komf.providers.mangadex.model.MangaDexResponse
import snd.komf.sources.mangadex.model.MangaDexAtHomeResponse
import snd.komf.sources.mangadex.model.MangaDexChapter

private const val apiUrl = "https://api.mangadex.org"

class MangaDexSourceClient(private val ktor: HttpClient) {

    suspend fun searchManga(
        query: String,
        limit: Int = 20,
        offset: Int = 0,
        availableTranslatedLanguage: String? = null,
    ): MangaDexPagedResponse<List<MangaDexManga>> {
        return ktor.get("$apiUrl/manga") {
            parameter("limit", limit.toString())
            parameter("offset", offset.toString())
            parameter("includes[]", "artist")
            parameter("includes[]", "author")
            parameter("includes[]", "cover_art")
            parameter("order[relevance]", "desc")
            parameter("contentRating[]", "safe")
            parameter("contentRating[]", "suggestive")
            parameter("contentRating[]", "erotica")
            parameter("title", query)
            availableTranslatedLanguage?.let { parameter("availableTranslatedLanguage[]", it) }
        }.body()
    }

    suspend fun getManga(mangaId: MangaDexMangaId): MangaDexManga {
        val response: MangaDexResponse<MangaDexManga> = ktor.get("$apiUrl/manga/${mangaId.value}") {
            parameter("includes[]", "artist")
            parameter("includes[]", "author")
            parameter("includes[]", "cover_art")
        }.body()
        return response.data
    }

    suspend fun getChapterList(
        mangaId: MangaDexMangaId,
        translatedLanguages: List<String>? = null,
        limit: Int = 100,
        offset: Int = 0,
    ): MangaDexPagedResponse<List<MangaDexChapter>> {
        return ktor.get("$apiUrl/manga/${mangaId.value}/feed") {
            parameter("limit", limit.toString())
            parameter("offset", offset.toString())
            parameter("order[chapter]", "asc")
            parameter("order[volume]", "asc")
            parameter("includes[]", "scanlation_group")
            translatedLanguages?.forEach { lang ->
                parameter("translatedLanguage[]", lang)
            }
        }.body()
    }

    suspend fun getChapterPages(chapterId: String): MangaDexAtHomeResponse {
        return ktor.get("$apiUrl/at-home/server/$chapterId").body()
    }
}
