package snd.komf.sources

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.time.Clock
import snd.komf.sources.model.HealthStatus
import snd.komf.sources.model.SourceHealthStatus
import java.util.concurrent.ConcurrentHashMap
import kotlin.time.Duration.Companion.minutes

private val logger = KotlinLogging.logger { }

class SourceHealthMonitor(
    private val sourcesModule: MangaSourcesModule,
    private val checkInterval: kotlin.time.Duration = 30.minutes,
) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val healthCache = ConcurrentHashMap<MangaSourceId, SourceHealthStatus>()

    fun start() {
        scope.launch {
            while (true) {
                checkAllSources()
                delay(checkInterval)
            }
        }
        logger.info { "SourceHealthMonitor started with check interval $checkInterval" }
    }

    fun getHealthStatus(): Map<MangaSourceId, SourceHealthStatus> {
        return healthCache.toMap()
    }

    fun getHealthStatus(sourceId: MangaSourceId): SourceHealthStatus {
        return healthCache[sourceId] ?: SourceHealthStatus(
            status = HealthStatus.RED,
            error = "Not checked yet",
            checkedAt = Clock.System.now(),
        )
    }

    suspend fun checkSource(sourceId: MangaSourceId): SourceHealthStatus {
        val source = sourcesModule.getSource(sourceId)
        val status = source.healthCheck()
        healthCache[sourceId] = status
        logger.info { "Health check for ${source.sourceName()}: ${status.status} (${status.latencyMs}ms)" }
        return status
    }

    private suspend fun checkAllSources() {
        logger.info { "Running health checks for all sources" }
        for ((sourceId, source) in sourcesModule.getAllSources()) {
            try {
                val status = source.healthCheck()
                healthCache[sourceId] = status
                logger.info { "Health check for ${source.sourceName()}: ${status.status} (${status.latencyMs}ms)" }
            } catch (e: Exception) {
                val errorStatus = SourceHealthStatus(
                    status = HealthStatus.RED,
                    error = e.message,
                    checkedAt = Clock.System.now(),
                )
                healthCache[sourceId] = errorStatus
                logger.error(e) { "Health check failed for ${source.sourceName()}" }
            }
        }
    }
}
