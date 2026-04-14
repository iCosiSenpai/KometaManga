package snd.komf.sources.mangadex

import kotlin.time.Clock
import snd.komf.providers.mangadex.model.MangaDexMangaId
import snd.komf.sources.MangaSource
import snd.komf.sources.MangaSourceId
import snd.komf.sources.model.ChapterPage
import snd.komf.sources.model.HealthStatus
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaDetails
import snd.komf.sources.model.MangaSearchResult
import snd.komf.sources.model.SourceHealthStatus
import kotlin.time.measureTimedValue

class MangaDexSource(
    private val client: MangaDexSourceClient,
) : MangaSource {

    override fun sourceId() = MangaSourceId.MANGADEX

    override fun sourceName() = "MangaDex"

    override fun supportedLanguages(): Set<String> = setOf(
        "en", "it", "ja", "ko", "zh", "zh-hk", "fr", "de", "es", "es-la",
        "pt", "pt-br", "ru", "pl", "tr", "ar", "th", "vi", "id",
    )

    override suspend fun searchManga(query: String, limit: Int, language: String?): List<MangaSearchResult> {
        val response = client.searchManga(query.take(400), limit.coerceAtMost(100), availableTranslatedLanguage = language)
        return response.data.map { MangaDexSourceMapper.toSearchResult(it) }
    }

    override suspend fun getMangaDetails(mangaId: String): MangaDetails {
        val manga = client.getManga(MangaDexMangaId(mangaId))
        return MangaDexSourceMapper.toMangaDetails(manga)
    }

    override suspend fun getChapters(mangaId: String, language: String?): List<MangaChapter> {
        val languages = language?.let { listOf(it) }
        val chapters = mutableListOf<MangaChapter>()
        var offset = 0
        var requestCount = 0

        while (requestCount < 50) {
            val page = client.getChapterList(
                mangaId = MangaDexMangaId(mangaId),
                translatedLanguages = languages,
                limit = 100,
                offset = offset,
            )

            // Prefer downloadable chapters (non-external URL). If a title only has
            // external chapters, keep them so the UI does not look empty.
            val chapterPageData = if (page.data.any { it.attributes.externalUrl == null }) {
                page.data.filter { it.attributes.externalUrl == null }
            } else {
                page.data
            }

            chapters.addAll(
                chapterPageData
                    .map { MangaDexSourceMapper.toChapter(it, mangaId) }
            )

            if (offset + page.limit >= page.total) break
            offset += page.limit
            requestCount++
        }

        return chapters
    }

    override suspend fun getChapterPages(chapterId: String): List<ChapterPage> {
        val atHomeResponse = client.getChapterPages(chapterId)
        return MangaDexSourceMapper.toChapterPages(atHomeResponse)
    }

    override suspend fun healthCheck(): SourceHealthStatus {
        return try {
            val (results, duration) = measureTimedValue {
                client.searchManga("one piece", limit = 1)
            }
            val latencyMs = duration.inWholeMilliseconds

            when {
                results.data.isEmpty() -> SourceHealthStatus(
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
