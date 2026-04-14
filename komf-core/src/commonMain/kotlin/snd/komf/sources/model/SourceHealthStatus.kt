package snd.komf.sources.model

import kotlin.time.Instant
import kotlinx.serialization.Serializable

@Serializable
enum class HealthStatus {
    GREEN,
    YELLOW,
    RED,
}

@Serializable
data class SourceHealthStatus(
    val status: HealthStatus,
    val latencyMs: Long? = null,
    val error: String? = null,
    val checkedAt: Instant? = null,
)
