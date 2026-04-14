package snd.komf.sources.model

import kotlin.time.Instant
import kotlinx.serialization.Serializable
import snd.komf.sources.MangaSourceId

@Serializable
data class MangaChapter(
    val id: String,
    val mangaId: String,
    val title: String? = null,
    val chapterNumber: String,
    val volumeNumber: String? = null,
    val language: String? = null,
    val scanlator: String? = null,
    val updatedAt: Instant? = null,
    val pageCount: Int? = null,
    val sourceId: MangaSourceId,
)
