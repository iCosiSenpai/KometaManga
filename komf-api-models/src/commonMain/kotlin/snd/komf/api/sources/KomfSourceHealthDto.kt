package snd.komf.api.sources

import kotlinx.serialization.Serializable

@Serializable
data class KomfSourceHealthDto(
    val sourceId: KomfMangaSourceId,
    val status: KomfHealthStatus,
    val latencyMs: Long? = null,
    val error: String? = null,
    val checkedAt: String? = null,
)
