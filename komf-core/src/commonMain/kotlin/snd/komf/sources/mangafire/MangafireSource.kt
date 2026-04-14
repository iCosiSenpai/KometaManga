package snd.komf.sources.mangafire

import kotlin.time.Clock
import snd.komf.sources.MangaSource
import snd.komf.sources.MangaSourceId
import snd.komf.sources.rankSearchResults
import snd.komf.sources.model.ChapterPage
import snd.komf.sources.model.HealthStatus
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaDetails
import snd.komf.sources.model.MangaSearchResult
import snd.komf.sources.model.SourceHealthStatus
import kotlin.time.measureTimedValue

class MangafireSource(
    private val client: MangafireSourceClient,
) : MangaSource {

    override fun sourceId() = MangaSourceId.MANGAFIRE

    override fun sourceName() = "MangaFire"

    override fun supportedLanguages(): Set<String> = setOf("en", "it")

    override suspend fun searchManga(query: String, limit: Int, language: String?): List<MangaSearchResult> {
        val cleanQuery = query.trim()
        val document = client.searchManga(cleanQuery)
        return rankSearchResults(cleanQuery, MangafireSourceMapper.parseSearchResults(document)).take(limit)
    }

    override suspend fun getMangaDetails(mangaId: String): MangaDetails {
        val document = client.getMangaDetails(mangaId)
        return MangafireSourceMapper.parseMangaDetails(document, mangaId)
    }

    override suspend fun getChapters(mangaId: String, language: String?): List<MangaChapter> {
        val document = client.getMangaDetails(mangaId)
        return MangafireSourceMapper.parseChapters(document, mangaId, language)
    }

    override suspend fun getChapterPages(chapterId: String): List<ChapterPage> {
        val document = client.getChapterPages(chapterId)
        return MangafireSourceMapper.parsePages(document)
    }

    override suspend fun healthCheck(): SourceHealthStatus {
        return try {
            val (results, duration) = measureTimedValue {
                // MangaFire intermittently returns empty result sets for some common probes
                // under bot-like traffic. "one piece" has been the most stable health query.
                searchManga("one piece", limit = 1)
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
