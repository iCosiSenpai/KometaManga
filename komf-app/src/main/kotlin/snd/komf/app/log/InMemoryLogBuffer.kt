package snd.komf.app.log

import java.util.concurrent.ConcurrentLinkedDeque
import kotlinx.serialization.Serializable

@Serializable
data class LogEntry(
    val timestamp: Long,
    val level: String,
    val logger: String,
    val message: String,
    val thread: String,
)

object InMemoryLogBuffer {
    private const val MAX_SIZE = 1000
    private val buffer = ConcurrentLinkedDeque<LogEntry>()

    fun add(entry: LogEntry) {
        buffer.addLast(entry)
        while (buffer.size > MAX_SIZE) buffer.pollFirst()
    }

    fun getLast(n: Int): List<LogEntry> = buffer.toList().takeLast(n)
}
