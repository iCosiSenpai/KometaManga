package snd.komf.mediaserver.notifications

import snd.komf.mediaserver.repository.NotificationLogQueries
import kotlin.time.Clock

data class NotificationLogEntry(
    val id: Long,
    val jobId: String?,
    val channel: String,
    val url: String,
    val status: String,
    val errorMessage: String?,
    val sentAt: kotlin.time.Instant,
)

class NotificationLogRepository(
    private val queries: NotificationLogQueries,
) {
    fun findAll(limit: Long = 50, offset: Long = 0): List<NotificationLogEntry> {
        return queries.findAll(limit, offset).executeAsList().map {
            NotificationLogEntry(
                id = it.id,
                jobId = it.jobId,
                channel = it.channel,
                url = it.url,
                status = it.status,
                errorMessage = it.errorMessage,
                sentAt = it.sentAt,
            )
        }
    }

    fun countAll(): Long = queries.countAll().executeAsOne()

    fun logSuccess(channel: String, url: String, jobId: String? = null) {
        queries.save(
            jobId = jobId,
            channel = channel,
            url = url,
            status = "SUCCESS",
            errorMessage = null,
            sentAt = Clock.System.now(),
        )
    }

    fun logFailure(channel: String, url: String, errorMessage: String, jobId: String? = null) {
        queries.save(
            jobId = jobId,
            channel = channel,
            url = url,
            status = "FAILED",
            errorMessage = errorMessage,
            sentAt = Clock.System.now(),
        )
    }

    fun deleteAllBeforeDate(instant: kotlin.time.Instant) {
        queries.deleteAllBeforeDate(instant)
    }
}
