package snd.komf.sources.mangadex.model

import kotlinx.serialization.Serializable
import kotlin.time.Instant

@Serializable
data class MangaDexChapter(
    val id: String,
    val type: String,
    val attributes: MangaDexChapterAttributes,
    val relationships: List<MangaDexChapterRelationship> = emptyList(),
)

@Serializable
data class MangaDexChapterAttributes(
    val volume: String? = null,
    val chapter: String? = null,
    val title: String? = null,
    val translatedLanguage: String? = null,
    val externalUrl: String? = null,
    val publishAt: Instant? = null,
    val readableAt: Instant? = null,
    val createdAt: Instant? = null,
    val updatedAt: Instant? = null,
    val pages: Int = 0,
    val version: Int = 1,
)

@Serializable
data class MangaDexChapterRelationship(
    val id: String,
    val type: String,
    val attributes: MangaDexScanlationGroupAttributes? = null,
)

@Serializable
data class MangaDexScanlationGroupAttributes(
    val name: String? = null,
)

@Serializable
data class MangaDexAtHomeResponse(
    val result: String,
    val baseUrl: String,
    val chapter: MangaDexAtHomeChapter,
)

@Serializable
data class MangaDexAtHomeChapter(
    val hash: String,
    val data: List<String>,
    val dataSaver: List<String>,
)
