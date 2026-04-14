package snd.komf.sources.model

import kotlinx.serialization.Serializable
import snd.komf.sources.MangaSourceId

@Serializable
data class MangaDetails(
    val id: String,
    val title: String,
    val alternativeTitles: List<String> = emptyList(),
    val description: String? = null,
    val coverUrl: String? = null,
    val authors: List<String> = emptyList(),
    val artists: List<String> = emptyList(),
    val genres: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val status: MangaStatus? = null,
    val year: Int? = null,
    val sourceId: MangaSourceId,
)
