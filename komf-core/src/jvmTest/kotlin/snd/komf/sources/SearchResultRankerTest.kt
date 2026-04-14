package snd.komf.sources

import kotlin.test.Test
import kotlin.test.assertEquals
import snd.komf.sources.model.MangaSearchResult

class SearchResultRankerTest {

    @Test
    fun `prefers exact match over partial franchise match`() {
        val results = listOf(
            MangaSearchResult(id = "boruto", title = "Boruto: Naruto Next Generations", sourceId = MangaSourceId.MANGAWORLD),
            MangaSearchResult(id = "naruto", title = "Naruto", sourceId = MangaSourceId.MANGAWORLD),
        )

        val ranked = rankSearchResults("naruto", results)

        assertEquals(listOf("naruto", "boruto"), ranked.map { it.id })
    }

    @Test
    fun `treats spaced and compact titles as the same name`() {
        val results = listOf(
            MangaSearchResult(id = "dan-da-dan", title = "Dan Da Dan", sourceId = MangaSourceId.MANGAWORLD),
            MangaSearchResult(id = "boruto", title = "Boruto", sourceId = MangaSourceId.MANGAWORLD),
        )

        val ranked = rankSearchResults("dandadan", results)

        assertEquals(listOf("dan-da-dan"), ranked.map { it.id })
    }

    @Test
    fun `filters unrelated results when search endpoint returns garbage`() {
        val results = listOf(
            MangaSearchResult(id = "one-piece", title = "One Piece", sourceId = MangaSourceId.MANGAFIRE),
            MangaSearchResult(id = "toriko", title = "Toriko", sourceId = MangaSourceId.MANGAFIRE),
        )

        val ranked = rankSearchResults("blue lock", results)

        assertEquals(emptyList(), ranked)
    }
}
