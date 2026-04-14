package snd.komf.sources.comick

import snd.komf.sources.MangaSourceId
import snd.komf.sources.comick.model.ComickBrowseComic
import snd.komf.sources.comick.model.ComickChapter
import snd.komf.sources.model.MangaStatus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ComickSourceMapperTest {

    @Test
    fun `toSearchResult maps browse comic fields`() {
        val comic = ComickBrowseComic(
            thumbnail = "https://comick.art/thumb/one-piece.jpg",
            slug = "one-piece",
            title = "One Piece",
        )
        val result = ComickSourceMapper.toSearchResult(comic)

        assertEquals("one-piece", result.id)
        assertEquals("One Piece", result.title)
        assertEquals("https://comick.art/thumb/one-piece.jpg", result.coverUrl)
        assertEquals(MangaSourceId.COMICK, result.sourceId)
    }

    @Test
    fun `toSearchResult handles null thumbnail`() {
        val comic = ComickBrowseComic(
            thumbnail = null,
            slug = "test-manga",
            title = "Test Manga",
        )
        val result = ComickSourceMapper.toSearchResult(comic)

        assertNull(result.coverUrl)
    }

    @Test
    fun `toMangaDetails maps all fields`() {
        val data = ComickBrowseComic(
            title = "Bleach",
            slug = "bleach",
            thumbnail = "https://comick.art/thumb/bleach.jpg",
            status = 2,
            translationCompleted = true,
            description = "Soul reaper adventures",
        )
        val details = ComickSourceMapper.toMangaDetails(data)

        assertEquals("bleach", details.id)
        assertEquals("Bleach", details.title)
        assertEquals("Soul reaper adventures", details.description)
        assertEquals("https://comick.art/thumb/bleach.jpg", details.coverUrl)
        assertEquals(MangaStatus.COMPLETED, details.status)
        assertEquals(MangaSourceId.COMICK, details.sourceId)
        assertEquals(emptyList(), details.authors)
        assertEquals(emptyList(), details.artists)
        assertEquals(emptyList(), details.genres)
    }

    @Test
    fun `toMangaDetails maps status correctly`() {
        fun detailsWithStatus(status: Int, completed: Boolean = false) =
            ComickSourceMapper.toMangaDetails(
                ComickBrowseComic(
                    title = "Test", slug = "test", status = status,
                    translationCompleted = completed,
                )
            )

        assertEquals(MangaStatus.ONGOING, detailsWithStatus(1).status)
        assertEquals(MangaStatus.COMPLETED, detailsWithStatus(2, true).status)
        assertEquals(MangaStatus.COMPLETED, detailsWithStatus(2, false).status)
        assertEquals(MangaStatus.CANCELLED, detailsWithStatus(3).status)
        assertEquals(MangaStatus.HIATUS, detailsWithStatus(4).status)
        assertEquals(MangaStatus.UNKNOWN, detailsWithStatus(99).status)
    }

    @Test
    fun `toChapter maps chapter fields`() {
        val chapter = ComickChapter(
            hid = "abc123",
            chap = "42",
            vol = "5",
            lang = "en",
            title = "The Awakening",
            groups = listOf("Scan Group A", "Scan Group B"),
        )
        val result = ComickSourceMapper.toChapter(chapter, "one-piece")

        assertEquals("https://comick.art/comic/one-piece/abc123-chapter-42-en", result.id)
        assertEquals("one-piece", result.mangaId)
        assertEquals("42", result.chapterNumber)
        assertEquals("5", result.volumeNumber)
        assertEquals("en", result.language)
        assertEquals("The Awakening", result.title)
        assertEquals("Scan Group A, Scan Group B", result.scanlator)
        assertEquals(MangaSourceId.COMICK, result.sourceId)
    }

    @Test
    fun `toChapter defaults chapter number to 0 when null`() {
        val chapter = ComickChapter(hid = "ch-x", chap = null)
        val result = ComickSourceMapper.toChapter(chapter, "test")

        assertEquals("https://comick.art/comic/test/ch-x-chapter-0-en", result.id)
        assertEquals("0", result.chapterNumber)
    }

    @Test
    fun `toChapter returns null scanlator when groups empty`() {
        val chapter = ComickChapter(hid = "ch-1", chap = "1", groups = emptyList())
        val result = ComickSourceMapper.toChapter(chapter, "test")

        assertNull(result.scanlator)
    }

    @Test
    fun `toChapter defaults language to en when null`() {
        val chapter = ComickChapter(hid = "ch-7", chap = "7", lang = null)
        val result = ComickSourceMapper.toChapter(chapter, "test")

        assertEquals("https://comick.art/comic/test/ch-7-chapter-7-en", result.id)
        assertNull(result.language)
    }

    @Test
    fun `toMangaDetails handles null description`() {
        val data = ComickBrowseComic(
            title = "Test",
            slug = "test",
            description = null,
        )
        val details = ComickSourceMapper.toMangaDetails(data)

        assertNull(details.description)
        assertEquals(emptyList(), details.authors)
        assertEquals(emptyList(), details.artists)
        assertEquals(emptyList(), details.genres)
    }
}
