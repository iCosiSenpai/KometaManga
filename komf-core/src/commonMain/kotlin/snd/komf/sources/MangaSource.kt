package snd.komf.sources

import snd.komf.sources.model.ChapterPage
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaDetails
import snd.komf.sources.model.MangaSearchResult
import snd.komf.sources.model.SourceHealthStatus

interface MangaSource {

    fun sourceId(): MangaSourceId

    fun sourceName(): String

    fun supportedLanguages(): Set<String>

    suspend fun searchManga(query: String, limit: Int = 20, language: String? = null): List<MangaSearchResult>

    suspend fun getMangaDetails(mangaId: String): MangaDetails

    suspend fun getChapters(mangaId: String, language: String? = null): List<MangaChapter>

    suspend fun getChapterPages(chapterId: String): List<ChapterPage>

    suspend fun healthCheck(): SourceHealthStatus
}
