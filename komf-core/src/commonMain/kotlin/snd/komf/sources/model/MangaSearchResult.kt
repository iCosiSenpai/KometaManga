package snd.komf.sources.model

import kotlinx.serialization.Serializable
import snd.komf.sources.MangaSourceId

@Serializable
data class MangaSearchResult(
    val id: String,
    val title: String,
    val alternativeTitles: List<String> = emptyList(),
    val coverUrl: String? = null,
    val year: Int? = null,
    val status: MangaStatus? = null,
    val contentRating: String? = null,
    val sourceId: MangaSourceId,
)
