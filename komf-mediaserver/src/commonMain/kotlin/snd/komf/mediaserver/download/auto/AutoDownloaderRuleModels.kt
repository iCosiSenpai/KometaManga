package snd.komf.mediaserver.download.auto

import java.util.UUID

@JvmInline
value class AutoDownloaderRuleId(val value: String) {
    companion object {
        fun generate(): AutoDownloaderRuleId = AutoDownloaderRuleId(UUID.randomUUID().toString())
    }
}

data class AutoDownloaderRuleRecord(
    val id: AutoDownloaderRuleId,
    val sourceId: snd.komf.sources.MangaSourceId,
    val mangaId: String,
    val mangaTitle: String,
    val language: String? = null,
    val scanlator: String? = null,
    val lastChapterNumber: Double? = null,
    val enabled: Boolean = true,
    val komgaLibraryId: String? = null,
    val komgaLibraryPath: String? = null,
)
