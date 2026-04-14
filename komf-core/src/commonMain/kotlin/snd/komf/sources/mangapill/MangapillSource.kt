package snd.komf.sources.mangapill

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

class MangapillSource(
    private val client: MangapillSourceClient,
) : MangaSource {

    override fun sourceId() = MangaSourceId.MANGAPILL

    override fun sourceName() = "Mangapill"

    override fun supportedLanguages(): Set<String> = setOf("en")

    override suspend fun searchManga(query: String, limit: Int, language: String?): List<MangaSearchResult> {
        val document = client.searchManga(query.trim())
        return MangapillSourceMapper.parseSearchResults(document).take(limit)
    }

    override suspend fun getMangaDetails(mangaId: String): MangaDetails {
        val document = client.getMangaDetails(mangaId)
        return MangapillSourceMapper.parseMangaDetails(document, mangaId)
    }

    override suspend fun getChapters(mangaId: String, language: String?): List<MangaChapter> {
        val document = client.getMangaDetails(mangaId)
        return MangapillSourceMapper.parseChapters(document, mangaId)
    }

    override suspend fun getChapterPages(chapterId: String): List<ChapterPage> {
        val document = client.getChapterPages(chapterId)
        return MangapillSourceMapper.parsePages(document)
    }

    override suspend fun healthCheck(): SourceHealthStatus {
        return try {
            val (results, duration) = measureTimedValue {
                searchManga("naruto", limit = 1)
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
