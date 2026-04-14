package snd.komf.api.mediaserver

import kotlinx.serialization.Serializable

@Serializable
data class KomfMediaServerSeries(
    val id: String,
    val libraryId: String,
    val name: String,
    val booksCount: Int,
)
