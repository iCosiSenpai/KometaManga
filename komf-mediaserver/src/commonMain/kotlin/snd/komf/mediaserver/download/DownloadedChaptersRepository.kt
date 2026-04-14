package snd.komf.mediaserver.download

import snd.komf.mediaserver.repository.DownloadedChapterQueries
import snd.komf.sources.MangaSourceId

class DownloadedChaptersRepository(
    private val queries: DownloadedChapterQueries,
) {
    fun findAll(limit: Long, offset: Long): List<DownloadedChapterRecord> {
        return queries.findAll(limit, offset).executeAsList().map { it.toRecord() }
    }

    fun countAll(): Long {
        return queries.countAll().executeAsOne()
    }

    fun get(id: DownloadedChapterId): DownloadedChapterRecord? {
        return queries.get(id).executeAsOneOrNull()?.toRecord()
    }

    fun findByMangaId(mangaId: String, sourceId: MangaSourceId): List<DownloadedChapterRecord> {
        return queries.findByMangaId(mangaId, sourceId).executeAsList().map { it.toRecord() }
    }

    fun findByChapterId(chapterId: String, sourceId: MangaSourceId): DownloadedChapterRecord? {
        return queries.findByChapterId(chapterId, sourceId).executeAsOneOrNull()?.toRecord()
    }

    fun totalSize(): Long {
        return queries.totalSize().executeAsOne()
    }

    fun save(record: DownloadedChapterRecord) {
        queries.save(
            snd.komf.mediaserver.repository.DownloadedChapter(
                id = record.id,
                sourceId = record.sourceId,
                mangaId = record.mangaId,
                mangaTitle = record.mangaTitle,
                chapterId = record.chapterId,
                chapterNumber = record.chapterNumber,
                volumeNumber = record.volumeNumber,
                language = record.language,
                filePath = record.filePath,
                fileSize = record.fileSize,
                pageCount = record.pageCount.toLong(),
                downloadedAt = record.downloadedAt,
            )
        )
    }

    fun delete(id: DownloadedChapterId) {
        queries.delete(id)
    }

    fun deleteAll() {
        queries.deleteAll()
    }

    private fun snd.komf.mediaserver.repository.DownloadedChapter.toRecord() = DownloadedChapterRecord(
        id = id,
        sourceId = sourceId,
        mangaId = mangaId,
        mangaTitle = mangaTitle,
        chapterId = chapterId,
        chapterNumber = chapterNumber,
        volumeNumber = volumeNumber,
        language = language,
        filePath = filePath,
        fileSize = fileSize,
        pageCount = pageCount.toInt(),
        downloadedAt = downloadedAt,
    )
}
