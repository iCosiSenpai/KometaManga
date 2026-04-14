package snd.komf.sources.mangadex

import snd.komf.providers.mangadex.model.MangaDexArtist
import snd.komf.providers.mangadex.model.MangaDexAttributes
import snd.komf.providers.mangadex.model.MangaDexAuthor
import snd.komf.providers.mangadex.model.MangaDexAuthorAttributes
import snd.komf.providers.mangadex.model.MangaDexCoverArt
import snd.komf.providers.mangadex.model.MangaDexCoverArtAttributes
import snd.komf.providers.mangadex.model.MangaDexManga
import snd.komf.providers.mangadex.model.MangaDexMangaId
import snd.komf.providers.mangadex.model.MangaDexTag
import snd.komf.providers.mangadex.model.MangaDexTagAttributes
import snd.komf.sources.MangaSourceId
import snd.komf.sources.mangadex.model.MangaDexAtHomeChapter
import snd.komf.sources.mangadex.model.MangaDexAtHomeResponse
import snd.komf.sources.mangadex.model.MangaDexChapter
import snd.komf.sources.mangadex.model.MangaDexChapterAttributes
import snd.komf.sources.mangadex.model.MangaDexChapterRelationship
import snd.komf.sources.mangadex.model.MangaDexScanlationGroupAttributes
import snd.komf.sources.model.MangaStatus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.time.Clock

class MangaDexSourceMapperTest {

    private val now = Clock.System.now()

    private fun createManga(
        id: String = "test-id",
        titleMap: Map<String, String> = mapOf("en" to "One Piece"),
        altTitles: List<Map<String, String>> = emptyList(),
        description: Map<String, String> = mapOf("en" to "A great manga"),
        status: String = "ongoing",
        year: Int? = 1997,
        publicationDemographic: String? = "shounen",
        tags: List<MangaDexTag> = emptyList(),
        relationships: List<snd.komf.providers.mangadex.model.MangaDexRelationship> = emptyList(),
    ): MangaDexManga {
        return MangaDexManga(
            id = MangaDexMangaId(id),
            type = "manga",
            attributes = MangaDexAttributes(
                title = titleMap,
                altTitles = altTitles,
                description = description,
                isLocked = false,
                links = null,
                originalLanguage = "ja",
                lastVolume = null,
                lastChapter = null,
                publicationDemographic = publicationDemographic,
                status = status,
                year = year,
                contentRating = "safe",
                tags = tags,
                state = "published",
                chapterNumbersResetOnNewVolume = false,
                createdAt = now,
                updatedAt = now,
                version = 1,
                latestUploadedChapter = null,
            ),
            relationships = relationships,
        )
    }

    @Test
    fun `toSearchResult maps title correctly`() {
        val manga = createManga(titleMap = mapOf("en" to "Naruto"))
        val result = MangaDexSourceMapper.toSearchResult(manga)

        assertEquals("Naruto", result.title)
        assertEquals("test-id", result.id)
        assertEquals(MangaSourceId.MANGADEX, result.sourceId)
    }

    @Test
    fun `toSearchResult falls back to first title when no English`() {
        val manga = createManga(titleMap = mapOf("ja" to "ワンピース", "fr" to "One Piece"))
        val result = MangaDexSourceMapper.toSearchResult(manga)

        assertEquals("ワンピース", result.title)
    }

    @Test
    fun `toSearchResult maps year and status`() {
        val manga = createManga(year = 2020, status = "completed")
        val result = MangaDexSourceMapper.toSearchResult(manga)

        assertEquals(2020, result.year)
        assertEquals(MangaStatus.COMPLETED, result.status)
    }

    @Test
    fun `toSearchResult builds cover URL from cover art relationship`() {
        val manga = createManga(
            id = "manga-abc",
            relationships = listOf(
                MangaDexCoverArt(
                    id = "cover-1",
                    attributes = MangaDexCoverArtAttributes(
                        fileName = "cover.jpg",
                        volume = null,
                        locale = null,
                    ),
                ),
            ),
        )
        val result = MangaDexSourceMapper.toSearchResult(manga)

        assertNotNull(result.coverUrl)
        assertEquals("https://uploads.mangadex.org/covers/manga-abc/cover.jpg.256.jpg", result.coverUrl)
    }

    @Test
    fun `toSearchResult returns null cover when no cover art relationship`() {
        val manga = createManga(relationships = emptyList())
        val result = MangaDexSourceMapper.toSearchResult(manga)

        assertNull(result.coverUrl)
    }

    @Test
    fun `toSearchResult maps alternative titles excluding main title`() {
        val manga = createManga(
            titleMap = mapOf("en" to "One Piece"),
            altTitles = listOf(
                mapOf("ja" to "ワンピース"),
                mapOf("en" to "One Piece"), // same as main — should be excluded
                mapOf("fr" to "One Piece FR"),
            ),
        )
        val result = MangaDexSourceMapper.toSearchResult(manga)

        assertEquals(2, result.alternativeTitles.size)
        assertTrue(result.alternativeTitles.contains("ワンピース"))
        assertTrue(result.alternativeTitles.contains("One Piece FR"))
    }

    @Test
    fun `toMangaDetails maps all fields`() {
        val manga = createManga(
            id = "detail-id",
            titleMap = mapOf("en" to "Bleach"),
            description = mapOf("en" to "Soul reapers fight hollows"),
            status = "hiatus",
            year = 2001,
            publicationDemographic = "shounen",
            tags = listOf(
                MangaDexTag(
                    id = "t1", type = "tag",
                    attributes = MangaDexTagAttributes(
                        name = mapOf("en" to "Action"),
                        description = emptyMap(),
                        group = "genre",
                        version = 1,
                    ),
                ),
                MangaDexTag(
                    id = "t2", type = "tag",
                    attributes = MangaDexTagAttributes(
                        name = mapOf("en" to "Supernatural"),
                        description = emptyMap(),
                        group = "theme",
                        version = 1,
                    ),
                ),
            ),
            relationships = listOf(
                MangaDexAuthor(
                    id = "a1",
                    attributes = MangaDexAuthorAttributes(name = "Tite Kubo"),
                ),
                MangaDexArtist(
                    id = "a2",
                    attributes = MangaDexAuthorAttributes(name = "Tite Kubo"),
                ),
                MangaDexCoverArt(
                    id = "c1",
                    attributes = MangaDexCoverArtAttributes("bleach-cover.jpg", null, null),
                ),
            ),
        )
        val details = MangaDexSourceMapper.toMangaDetails(manga)

        assertEquals("detail-id", details.id)
        assertEquals("Bleach", details.title)
        assertEquals("Soul reapers fight hollows", details.description)
        assertEquals(MangaStatus.HIATUS, details.status)
        assertEquals(2001, details.year)
        assertEquals(MangaSourceId.MANGADEX, details.sourceId)
        assertEquals(listOf("Tite Kubo"), details.authors)
        assertEquals(listOf("Tite Kubo"), details.artists)
        // genres = demographic + genre tags
        assertTrue(details.genres.contains("shounen"))
        assertTrue(details.genres.contains("Action"))
        // theme tags go to tags
        assertTrue(details.tags.contains("Supernatural"))
        assertNotNull(details.coverUrl)
        assertTrue(details.coverUrl!!.contains("512.jpg"))
    }

    @Test
    fun `toMangaDetails maps cover with 512 size`() {
        val manga = createManga(
            id = "cover-test",
            relationships = listOf(
                MangaDexCoverArt(
                    id = "c1",
                    attributes = MangaDexCoverArtAttributes("mycover.png", null, null),
                ),
            ),
        )
        val details = MangaDexSourceMapper.toMangaDetails(manga)

        assertEquals("https://uploads.mangadex.org/covers/cover-test/mycover.png.512.jpg", details.coverUrl)
    }

    @Test
    fun `toChapter maps chapter attributes`() {
        val chapter = MangaDexChapter(
            id = "ch-1",
            type = "chapter",
            attributes = MangaDexChapterAttributes(
                volume = "5",
                chapter = "42",
                title = "The Battle Begins",
                translatedLanguage = "it",
                pages = 20,
                updatedAt = now,
            ),
            relationships = listOf(
                MangaDexChapterRelationship(
                    id = "group-1",
                    type = "scanlation_group",
                    attributes = MangaDexScanlationGroupAttributes(name = "ITA Scans"),
                ),
            ),
        )
        val result = MangaDexSourceMapper.toChapter(chapter, "manga-123")

        assertEquals("ch-1", result.id)
        assertEquals("manga-123", result.mangaId)
        assertEquals("The Battle Begins", result.title)
        assertEquals("42", result.chapterNumber)
        assertEquals("5", result.volumeNumber)
        assertEquals("it", result.language)
        assertEquals("ITA Scans", result.scanlator)
        assertEquals(20, result.pageCount)
        assertEquals(MangaSourceId.MANGADEX, result.sourceId)
    }

    @Test
    fun `toChapter defaults chapter number to 0 when null`() {
        val chapter = MangaDexChapter(
            id = "ch-2",
            type = "chapter",
            attributes = MangaDexChapterAttributes(chapter = null),
        )
        val result = MangaDexSourceMapper.toChapter(chapter, "manga-1")

        assertEquals("0", result.chapterNumber)
    }

    @Test
    fun `toChapterPages builds correct URLs`() {
        val response = MangaDexAtHomeResponse(
            result = "ok",
            baseUrl = "https://uploads.mangadex.org",
            chapter = MangaDexAtHomeChapter(
                hash = "abc123hash",
                data = listOf("page1.jpg", "page2.png", "page3.webp"),
                dataSaver = emptyList(),
            ),
        )

        val pages = MangaDexSourceMapper.toChapterPages(response)

        assertEquals(3, pages.size)
        assertEquals(0, pages[0].index)
        assertEquals("https://uploads.mangadex.org/data/abc123hash/page1.jpg", pages[0].imageUrl)
        assertEquals(1, pages[1].index)
        assertEquals("https://uploads.mangadex.org/data/abc123hash/page2.png", pages[1].imageUrl)
        assertEquals(2, pages[2].index)
        assertEquals("https://uploads.mangadex.org/data/abc123hash/page3.webp", pages[2].imageUrl)
    }

    @Test
    fun `mapStatus maps all known statuses`() {
        assertEquals(MangaStatus.ONGOING, MangaDexSourceMapper.toSearchResult(createManga(status = "ongoing")).status)
        assertEquals(MangaStatus.COMPLETED, MangaDexSourceMapper.toSearchResult(createManga(status = "completed")).status)
        assertEquals(MangaStatus.HIATUS, MangaDexSourceMapper.toSearchResult(createManga(status = "hiatus")).status)
        assertEquals(MangaStatus.CANCELLED, MangaDexSourceMapper.toSearchResult(createManga(status = "cancelled")).status)
        assertEquals(MangaStatus.UNKNOWN, MangaDexSourceMapper.toSearchResult(createManga(status = "???")).status)
    }

    private fun assertTrue(condition: Boolean) = kotlin.test.assertTrue(condition)
}
