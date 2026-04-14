package snd.komf.mediaserver.download.auto

import snd.komf.mediaserver.repository.AutoDownloaderRuleQueries
import snd.komf.sources.MangaSourceId

class AutoDownloaderRuleRepository(
    private val queries: AutoDownloaderRuleQueries,
) {
    fun findAll(): List<AutoDownloaderRuleRecord> {
        return queries.findAll().executeAsList().map { it.toRecord() }
    }

    fun findEnabled(): List<AutoDownloaderRuleRecord> {
        return queries.findEnabled().executeAsList().map { it.toRecord() }
    }

    fun get(id: AutoDownloaderRuleId): AutoDownloaderRuleRecord? {
        return queries.get(id).executeAsOneOrNull()?.toRecord()
    }

    fun save(record: AutoDownloaderRuleRecord) {
        queries.save(
            snd.komf.mediaserver.repository.AutoDownloaderRule(
                id = record.id,
                sourceId = record.sourceId,
                mangaId = record.mangaId,
                mangaTitle = record.mangaTitle,
                language = record.language,
                scanlator = record.scanlator,
                lastChapterNumber = record.lastChapterNumber,
                enabled = if (record.enabled) 1L else 0L,
                komgaLibraryId = record.komgaLibraryId,
                komgaLibraryPath = record.komgaLibraryPath,
            )
        )
    }

    fun updateLastChapter(id: AutoDownloaderRuleId, lastChapterNumber: Double) {
        queries.updateLastChapter(lastChapterNumber, id)
    }

    fun delete(id: AutoDownloaderRuleId) {
        queries.delete(id)
    }

    fun deleteAll() {
        queries.deleteAll()
    }

    private fun snd.komf.mediaserver.repository.AutoDownloaderRule.toRecord() = AutoDownloaderRuleRecord(
        id = id,
        sourceId = sourceId,
        mangaId = mangaId,
        mangaTitle = mangaTitle,
        language = language,
        scanlator = scanlator,
        lastChapterNumber = lastChapterNumber,
        enabled = enabled != 0L,
        komgaLibraryId = komgaLibraryId,
        komgaLibraryPath = komgaLibraryPath,
    )
}
