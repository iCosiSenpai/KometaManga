package snd.komf.sources.model

import kotlinx.serialization.Serializable

@Serializable
enum class MangaStatus {
    ONGOING,
    COMPLETED,
    HIATUS,
    CANCELLED,
    UNKNOWN,
}
