package snd.komf.sources.model

import kotlinx.serialization.Serializable

@Serializable
data class ChapterPage(
    val index: Int,
    val imageUrl: String,
    val headers: Map<String, String> = emptyMap(),
)
