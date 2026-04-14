package snd.komf.api.sources

import kotlinx.serialization.Serializable

@Serializable
data class KomfAutoDownloaderRuleDto(
    val id: String,
    val sourceId: KomfMangaSourceId,
    val mangaId: String,
    val mangaTitle: String,
    val language: String? = null,
    val scanlator: String? = null,
    val lastChapterNumber: Double? = null,
    val enabled: Boolean = true,
    val komgaLibraryId: String? = null,
    val komgaLibraryPath: String? = null,
)

@Serializable
data class KomfAutoDownloaderStatusDto(
    val enabled: Boolean,
    val lastCheck: String? = null,
    val nextCheck: String? = null,
    val activeRulesCount: Int,
)

@Serializable
data class KomfCreateAutoDownloaderRuleDto(
    val sourceId: KomfMangaSourceId,
    val mangaId: String,
    val mangaTitle: String,
    val language: String? = null,
    val scanlator: String? = null,
    val lastChapterNumber: Double? = null,
    val enabled: Boolean = true,
    val komgaLibraryId: String? = null,
    val komgaLibraryPath: String? = null,
)

@Serializable
data class KomfUpdateAutoDownloaderRuleDto(
    val language: String? = null,
    val scanlator: String? = null,
    val lastChapterNumber: Double? = null,
    val enabled: Boolean? = null,
    val komgaLibraryId: String? = null,
    val komgaLibraryPath: String? = null,
)
