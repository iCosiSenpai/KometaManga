package snd.komf.mediaserver.jobs

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import snd.komf.mediaserver.model.MediaServerSeriesId
import java.util.concurrent.ConcurrentHashMap
import kotlin.time.Clock
import kotlin.time.Duration.Companion.days
import kotlin.time.Duration.Companion.hours

private val logger = KotlinLogging.logger {}

class KomfJobTracker(
    private val jobsRepository: KomfJobsRepository,
    private val retentionDays: Int = 30
) {
    private val activeJobs = ConcurrentHashMap<MetadataJobId, ActiveJob>()
    private val coroutineScope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var cleanupJob: Job? = null

    init {
        coroutineScope.launch {
            jobsRepository.cancelAllRunning()
            runCleanup()
        }
        startPeriodicCleanup()
    }

    private fun startPeriodicCleanup() {
        cleanupJob = coroutineScope.launch {
            while (isActive) {
                delay(24.hours)
                runCleanup()
            }
        }
    }

    private fun runCleanup() {
        val totalCount = jobsRepository.countAll()
        if (totalCount > 10_000) {
            val cutoff = Clock.System.now().minus(retentionDays.days)
            val deleted = jobsRepository.deleteAllBeforeDate(cutoff)
            logger.info { "Job cleanup: removed records older than $retentionDays days (total was $totalCount)" }
        }
    }

    fun registerMetadataJob(
        seriesId: MediaServerSeriesId,
        flow: SharedFlow<MetadataJobEvent>,
    ): MetadataJobId {
        val job = MetadataJob(seriesId = seriesId)
        jobsRepository.save(job)

        val listenerJob = flow
            .onEach { event ->
                when (event) {
                    is MetadataJobEvent.ProviderErrorEvent -> {
                        val activeJob = requireNotNull(activeJobs.remove(job.id))
                        jobsRepository.save(
                            activeJob.metadataJob.fail("${event.provider}\n${event.message}")
                        )
                        activeJob.flowCompletionListener.cancel()
                    }

                    is MetadataJobEvent.ProcessingErrorEvent -> {
                        val activeJob = requireNotNull(activeJobs.remove(job.id))
                        jobsRepository.save(activeJob.metadataJob.fail(event.message))
                        activeJob.flowCompletionListener.cancel()
                    }

                    MetadataJobEvent.CompletionEvent -> {
                        val activeJob = requireNotNull(activeJobs.remove(job.id))
                        jobsRepository.save(activeJob.metadataJob.complete())
                        activeJob.flowCompletionListener.cancel()
                    }

                    else -> {}
                }
            }.launchIn(coroutineScope)

        activeJobs[job.id] = ActiveJob(job, flow, listenerJob)
        return job.id
    }

    fun getMetadataJobEvents(jobId: MetadataJobId): SharedFlow<MetadataJobEvent>? {
        return activeJobs[jobId]?.eventFlow
    }

    fun cancelMetadataJob(jobId: MetadataJobId): Boolean {
        val activeJob = activeJobs.remove(jobId) ?: return false
        activeJob.processingJob?.cancel()
        activeJob.flowCompletionListener.cancel()
        jobsRepository.save(activeJob.metadataJob.fail("Cancelled by user"))
        return true
    }

    fun setProcessingJob(jobId: MetadataJobId, job: Job) {
        activeJobs.computeIfPresent(jobId) { _, active ->
            active.copy(processingJob = job)
        }
    }

    private data class ActiveJob(
        val metadataJob: MetadataJob,
        val eventFlow: SharedFlow<MetadataJobEvent>,
        val flowCompletionListener: Job,
        val processingJob: Job? = null,
    )
}
