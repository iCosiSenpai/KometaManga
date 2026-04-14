package snd.komf.api.sources

import kotlinx.serialization.Serializable

@Serializable
data class KomfMangaSourceDto(
    val sourceId: KomfMangaSourceId,
    val name: String,
    val languages: Set<String>,
    val enabled: Boolean,
)

@Serializable
data class KomfMangaSearchResultDto(
    val id: String,
    val title: String,
    val alternativeTitles: List<String> = emptyList(),
    val coverUrl: String? = null,
    val year: Int? = null,
    val status: KomfMangaStatus? = null,
    val sourceId: KomfMangaSourceId,
)

@Serializable
data class KomfMangaDetailsDto(
    val id: String,
    val title: String,
    val alternativeTitles: List<String> = emptyList(),
    val description: String? = null,
    val coverUrl: String? = null,
    val authors: List<String> = emptyList(),
    val artists: List<String> = emptyList(),
    val genres: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val status: KomfMangaStatus? = null,
    val year: Int? = null,
    val sourceId: KomfMangaSourceId,
)

@Serializable
data class KomfMangaChapterDto(
    val id: String,
    val mangaId: String,
    val title: String? = null,
    val chapterNumber: String,
    val volumeNumber: String? = null,
    val language: String? = null,
    val scanlator: String? = null,
    val updatedAt: String? = null,
    val pageCount: Int? = null,
    val sourceId: KomfMangaSourceId,
)

@Serializable
data class KomfChapterPageDto(
    val index: Int,
    val imageUrl: String,
)
