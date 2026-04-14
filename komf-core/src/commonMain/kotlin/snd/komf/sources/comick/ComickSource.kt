package snd.komf.sources.comick

import kotlin.time.Clock
import snd.komf.sources.MangaSource
import snd.komf.sources.MangaSourceId
import snd.komf.sources.model.ChapterPage
import snd.komf.sources.model.HealthStatus
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaDetails
import snd.komf.sources.model.MangaSearchResult
import snd.komf.sources.model.SourceHealthStatus
import kotlin.time.measureTimedValue

private const val COMICK_BASE_URL = "https://comick.art/"

class ComickSource(
    private val client: ComickSourceClient,
) : MangaSource {

    override fun sourceId() = MangaSourceId.COMICK

    override fun sourceName() = "Comick"

    override fun supportedLanguages(): Set<String> = setOf(
        "en", "it", "ja", "ko", "zh", "zh-hk", "fr", "de", "es", "es-la",
        "pt", "pt-br", "ru", "pl", "tr", "ar", "th", "vi", "id",
    )

    override suspend fun searchManga(query: String, limit: Int, language: String?): List<MangaSearchResult> {
        val results = client.searchManga(query.trim(), limit)
        return results.map { ComickSourceMapper.toSearchResult(it) }
    }

    override suspend fun getMangaDetails(mangaId: String): MangaDetails {
        val data = client.getMangaBySlug(mangaId)
            ?: throw IllegalStateException("Manga not found on Comick: $mangaId")
        return ComickSourceMapper.toMangaDetails(data)
    }

    override suspend fun getChapters(mangaId: String, language: String?): List<MangaChapter> {
        val chapters = mutableListOf<MangaChapter>()
        var page = 1
        var requestCount = 0

        while (requestCount < 50) {
            val response = client.getChapterList(mangaId, language, page)
            chapters.addAll(
                response.data.map { ComickSourceMapper.toChapter(it, mangaId) }
            )

            val pagination = response.pagination
            if (pagination == null || pagination.page >= pagination.lastPage) break
            page++
            requestCount++
        }

        return chapters
    }

    override suspend fun getChapterPages(chapterId: String): List<ChapterPage> {
        val pageData = client.getChapterPages(chapterId)
        val referer = chapterId.takeIf { it.startsWith("http://") || it.startsWith("https://") } ?: COMICK_BASE_URL
        return pageData.chapter.images.mapIndexed { index, image ->
            ChapterPage(
                index = index,
                imageUrl = image.url,
                headers = mapOf("Referer" to referer),
            )
        }
    }

    override suspend fun healthCheck(): SourceHealthStatus {
        return try {
            val (results, duration) = measureTimedValue {
                client.searchManga("one piece", limit = 1)
            }
            val latencyMs = duration.inWholeMilliseconds

            when {
                results.isEmpty() -> SourceHealthStatus(
                    status = HealthStatus.YELLOW,
                    latencyMs = latencyMs,
                    error = "Empty results",
                    checkedAt = Clock.System.now(),
                )

                latencyMs > 10_000 -> SourceHealthStatus(
                    status = HealthStatus.RED,
                    latencyMs = latencyMs,
                    checkedAt = Clock.System.now(),
                )

                latencyMs > 2_000 -> SourceHealthStatus(
                    status = HealthStatus.YELLOW,
                    latencyMs = latencyMs,
                    checkedAt = Clock.System.now(),
                )

                else -> SourceHealthStatus(
                    status = HealthStatus.GREEN,
                    latencyMs = latencyMs,
                    checkedAt = Clock.System.now(),
                )
            }
        } catch (e: Exception) {
            SourceHealthStatus(
                status = HealthStatus.RED,
                error = e.message,
                checkedAt = Clock.System.now(),
            )
        }
    }
}
