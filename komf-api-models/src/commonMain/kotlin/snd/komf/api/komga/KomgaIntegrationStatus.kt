package snd.komf.api.komga

import kotlinx.serialization.Serializable

@Serializable
data class KomgaIntegrationStatus(
    val connected: Boolean,
    val baseUri: String,
    val errorMessage: String? = null
)
