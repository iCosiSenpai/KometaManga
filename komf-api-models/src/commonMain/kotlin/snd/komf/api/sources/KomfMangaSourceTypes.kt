package snd.komf.api.sources

import kotlinx.serialization.Serializable

@Serializable
enum class KomfMangaSourceId {
    MANGADEX,
    COMICK,
    MANGAWORLD,
    SCANITA,
    NINEMANGA,
    MANGAPILL,
    MANGAFIRE,
}

@Serializable
enum class KomfMangaStatus {
    ONGOING,
    COMPLETED,
    HIATUS,
    CANCELLED,
    UNKNOWN,
}

@Serializable
enum class KomfHealthStatus {
    GREEN,
    YELLOW,
    RED,
}
