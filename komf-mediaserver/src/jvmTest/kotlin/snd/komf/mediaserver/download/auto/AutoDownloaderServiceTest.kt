package snd.komf.mediaserver.download.auto

import snd.komf.sources.MangaSourceId
import snd.komf.sources.model.MangaChapter
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * In-memory implementation of AutoDownloaderRuleRepository for testing.
 */
class InMemoryAutoDownloaderRuleRepository {
    private val rules = mutableMapOf<AutoDownloaderRuleId, AutoDownloaderRuleRecord>()

    fun findAll(): List<AutoDownloaderRuleRecord> = rules.values.toList()

    fun findEnabled(): List<AutoDownloaderRuleRecord> =
        rules.values.filter { it.enabled }

    fun get(id: AutoDownloaderRuleId): AutoDownloaderRuleRecord? = rules[id]

    fun save(record: AutoDownloaderRuleRecord) {
        rules[record.id] = record
    }

    fun updateLastChapter(id: AutoDownloaderRuleId, lastChapterNumber: Double) {
        val existing = rules[id] ?: return
        rules[id] = existing.copy(lastChapterNumber = lastChapterNumber)
    }

    fun delete(id: AutoDownloaderRuleId) {
        rules.remove(id)
    }

    fun deleteAll() {
        rules.clear()
    }
}

class AutoDownloaderServiceTest {

    @Test
    fun `rule CRUD operations work correctly`() {
        val repo = InMemoryAutoDownloaderRuleRepository()

        // Create
        val rule = AutoDownloaderRuleRecord(
            id = AutoDownloaderRuleId.generate(),
            sourceId = MangaSourceId.MANGADEX,
            mangaId = "manga-1",
            mangaTitle = "One Piece",
            language = "en",
            scanlator = null,
            lastChapterNumber = 1100.0,
            enabled = true,
        )
        repo.save(rule)

        assertEquals(1, repo.findAll().size)
        assertEquals(1, repo.findEnabled().size)
        assertNotNull(repo.get(rule.id))

        // Update last chapter
        repo.updateLastChapter(rule.id, 1101.0)
        assertEquals(1101.0, repo.get(rule.id)!!.lastChapterNumber)

        // Disable
        repo.save(rule.copy(enabled = false))
        assertEquals(0, repo.findEnabled().size)
        assertEquals(1, repo.findAll().size)

        // Delete
        repo.delete(rule.id)
        assertEquals(0, repo.findAll().size)
        assertNull(repo.get(rule.id))
    }

    @Test
    fun `chapter filtering by lastChapterNumber works`() {
        val lastChapter = 42.0
        val allChapters = listOf(
            MangaChapter(id = "c40", mangaId = "m1", chapterNumber = "40", sourceId = MangaSourceId.MANGADEX),
            MangaChapter(id = "c41", mangaId = "m1", chapterNumber = "41", sourceId = MangaSourceId.MANGADEX),
            MangaChapter(id = "c42", mangaId = "m1", chapterNumber = "42", sourceId = MangaSourceId.MANGADEX),
            MangaChapter(id = "c43", mangaId = "m1", chapterNumber = "43", sourceId = MangaSourceId.MANGADEX),
            MangaChapter(id = "c44", mangaId = "m1", chapterNumber = "44", sourceId = MangaSourceId.MANGADEX),
            MangaChapter(id = "c44.5", mangaId = "m1", chapterNumber = "44.5", sourceId = MangaSourceId.MANGADEX),
        )

        // Simulate the filtering logic from AutoDownloaderService.processRule
        val newChapters = allChapters.filter { chapter ->
            val chapterNum = chapter.chapterNumber.toDoubleOrNull() ?: return@filter false
            chapterNum > lastChapter
        }

        assertEquals(3, newChapters.size)
        assertEquals("43", newChapters[0].chapterNumber)
        assertEquals("44", newChapters[1].chapterNumber)
        assertEquals("44.5", newChapters[2].chapterNumber)
    }

    @Test
    fun `chapter filtering by scanlator works`() {
        val ruleScanlator = "Official Scans"
        val allChapters = listOf(
            MangaChapter(id = "c1", mangaId = "m1", chapterNumber = "1", scanlator = "Official Scans", sourceId = MangaSourceId.MANGADEX),
            MangaChapter(id = "c2", mangaId = "m1", chapterNumber = "2", scanlator = "Fan Group", sourceId = MangaSourceId.MANGADEX),
            MangaChapter(id = "c3", mangaId = "m1", chapterNumber = "3", scanlator = "Official Scans", sourceId = MangaSourceId.MANGADEX),
            MangaChapter(id = "c4", mangaId = "m1", chapterNumber = "4", scanlator = null, sourceId = MangaSourceId.MANGADEX),
        )

        // Simulate scanlator filtering from AutoDownloaderService.processRule
        val filtered = allChapters.filter { chapter ->
            ruleScanlator == null || chapter.scanlator == ruleScanlator
        }

        assertEquals(2, filtered.size)
        assertEquals("c1", filtered[0].id)
        assertEquals("c3", filtered[1].id)
    }

    @Test
    fun `combined filtering by lastChapter and scanlator`() {
        val lastChapter = 10.0
        val ruleScanlator = "Group A"

        val allChapters = listOf(
            MangaChapter(id = "c9", mangaId = "m1", chapterNumber = "9", scanlator = "Group A", sourceId = MangaSourceId.COMICK),
            MangaChapter(id = "c10", mangaId = "m1", chapterNumber = "10", scanlator = "Group A", sourceId = MangaSourceId.COMICK),
            MangaChapter(id = "c11a", mangaId = "m1", chapterNumber = "11", scanlator = "Group A", sourceId = MangaSourceId.COMICK),
            MangaChapter(id = "c11b", mangaId = "m1", chapterNumber = "11", scanlator = "Group B", sourceId = MangaSourceId.COMICK),
            MangaChapter(id = "c12", mangaId = "m1", chapterNumber = "12", scanlator = "Group A", sourceId = MangaSourceId.COMICK),
        )

        // Simulate the combined filter from AutoDownloaderService.processRule
        val filtered = allChapters.filter { chapter ->
            if (ruleScanlator != null && chapter.scanlator != ruleScanlator) return@filter false
            val chapterNum = chapter.chapterNumber.toDoubleOrNull() ?: return@filter false
            if (lastChapter != null && chapterNum <= lastChapter) return@filter false
            true
        }

        assertEquals(2, filtered.size)
        assertEquals("c11a", filtered[0].id) // chapter 11, Group A
        assertEquals("c12", filtered[1].id)  // chapter 12, Group A
    }

    @Test
    fun `updateLastChapter computes max chapter correctly`() {
        val newChapters = listOf(
            MangaChapter(id = "c43", mangaId = "m1", chapterNumber = "43", sourceId = MangaSourceId.MANGADEX),
            MangaChapter(id = "c44", mangaId = "m1", chapterNumber = "44", sourceId = MangaSourceId.MANGADEX),
            MangaChapter(id = "c44.5", mangaId = "m1", chapterNumber = "44.5", sourceId = MangaSourceId.MANGADEX),
        )

        // Simulate max chapter computation from AutoDownloaderService
        val maxChapter = newChapters
            .mapNotNull { it.chapterNumber.toDoubleOrNull() }
            .maxOrNull()

        assertNotNull(maxChapter)
        assertEquals(44.5, maxChapter)
    }

    @Test
    fun `chapters with non-numeric numbers are skipped`() {
        val lastChapter = 5.0
        val chapters = listOf(
            MangaChapter(id = "c6", mangaId = "m1", chapterNumber = "6", sourceId = MangaSourceId.MANGADEX),
            MangaChapter(id = "cextra", mangaId = "m1", chapterNumber = "extra", sourceId = MangaSourceId.MANGADEX),
            MangaChapter(id = "cspecial", mangaId = "m1", chapterNumber = "SP1", sourceId = MangaSourceId.MANGADEX),
            MangaChapter(id = "c7", mangaId = "m1", chapterNumber = "7", sourceId = MangaSourceId.MANGADEX),
        )

        val filtered = chapters.filter { chapter ->
            val chapterNum = chapter.chapterNumber.toDoubleOrNull() ?: return@filter false
            chapterNum > lastChapter
        }

        assertEquals(2, filtered.size)
        assertEquals("c6", filtered[0].id)
        assertEquals("c7", filtered[1].id)
    }

    @Test
    fun `findEnabled returns only enabled rules`() {
        val repo = InMemoryAutoDownloaderRuleRepository()

        val rule1 = AutoDownloaderRuleRecord(
            id = AutoDownloaderRuleId.generate(), sourceId = MangaSourceId.MANGADEX,
            mangaId = "m1", mangaTitle = "Manga A", enabled = true,
        )
        val rule2 = AutoDownloaderRuleRecord(
            id = AutoDownloaderRuleId.generate(), sourceId = MangaSourceId.COMICK,
            mangaId = "m2", mangaTitle = "Manga B", enabled = false,
        )
        val rule3 = AutoDownloaderRuleRecord(
            id = AutoDownloaderRuleId.generate(), sourceId = MangaSourceId.MANGAWORLD,
            mangaId = "m3", mangaTitle = "Manga C", enabled = true,
        )

        repo.save(rule1)
        repo.save(rule2)
        repo.save(rule3)

        val enabled = repo.findEnabled()
        assertEquals(2, enabled.size)
        assertTrue(enabled.all { it.enabled })
    }
}
