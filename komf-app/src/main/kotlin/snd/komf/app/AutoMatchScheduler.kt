package snd.komf.app

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import snd.komf.mediaserver.MediaServerClient
import snd.komf.mediaserver.MetadataServiceProvider
import snd.komf.mediaserver.model.MediaServerLibraryId
import kotlin.time.Duration.Companion.hours

private val logger = KotlinLogging.logger {}

class AutoMatchScheduler(
    private val metadataServiceProvider: MetadataServiceProvider,
    private val mediaServerClient: MediaServerClient,
    private val intervalHours: Int,
) {
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var job: kotlinx.coroutines.Job? = null

    fun start() {
        job = scope.launch {
            logger.info { "Auto-match scheduler started (interval: ${intervalHours}h)" }
            while (isActive) {
                delay(intervalHours.hours)
                runAutoMatch()
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
    }

    private suspend fun runAutoMatch() {
        logger.info { "Auto-match scheduler: starting library scan" }
        runCatching {
            val libraries = mediaServerClient.getLibraries()
            for (library in libraries) {
                val service = metadataServiceProvider.metadataServiceFor(library.id.value)
                service.matchLibraryMetadata(MediaServerLibraryId(library.id.value))
            }
            logger.info { "Auto-match scheduler: finished scanning ${libraries.size} libraries" }
        }.onFailure { e ->
            logger.error(e) { "Auto-match scheduler: error during library scan" }
        }
    }
}
