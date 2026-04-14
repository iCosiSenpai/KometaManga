package snd.komf.sources.ninemanga

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

class NineMangaSource(
    private val client: NineMangaSourceClient,
    private val id: MangaSourceId,
    private val name: String,
    private val language: String,
    private val baseUrl: String,
) : MangaSource {

    override fun sourceId() = id

    override fun sourceName() = name

    override fun supportedLanguages(): Set<String> = setOf(language)

    override suspend fun searchManga(query: String, limit: Int, language: String?): List<MangaSearchResult> {
        val document = client.searchManga(query.trim())
        return NineMangaSourceMapper.parseSearchResults(document, id).take(limit)
    }

    override suspend fun getMangaDetails(mangaId: String): MangaDetails {
        val document = client.getMangaDetails(mangaId)
        return NineMangaSourceMapper.parseMangaDetails(document, mangaId, id)
    }

    override suspend fun getChapters(mangaId: String, language: String?): List<MangaChapter> {
        val document = client.getChapterList(mangaId)
        return NineMangaSourceMapper.parseChapters(document, mangaId, this.language, id)
    }

    override suspend fun getChapterPages(chapterId: String): List<ChapterPage> {
        val document = client.getChapterPages(chapterId)
        return NineMangaSourceMapper.parsePages(document, chapterId)
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
