package snd.komf.app

import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.AppenderBase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.slf4j.LoggerFactory
import snd.komf.app.log.InMemoryLogBuffer
import snd.komf.app.log.LogEntry
import java.nio.file.Path
import kotlin.system.exitProcess

private val logger = KotlinLogging.logger {}

fun main(vararg args: String) {
    // Install in-memory log capture so the frontend can read application logs
    val rootLogger = LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME) as Logger
    val bufferAppender = object : AppenderBase<ILoggingEvent>() {
        override fun append(event: ILoggingEvent) {
            InMemoryLogBuffer.add(
                LogEntry(
                    timestamp = event.timeStamp,
                    level = event.level.toString(),
                    logger = event.loggerName,
                    message = event.formattedMessage,
                    thread = event.threadName,
                )
            )
        }
    }
    bufferAppender.context = rootLogger.loggerContext
    bufferAppender.name = "IN_MEMORY"
    bufferAppender.start()
    rootLogger.addAppender(bufferAppender)

    runCatching {
        val configFile = args.firstOrNull()?.let { Path.of(it) }
        val configDir = System.getenv("KOMF_CONFIG_DIR")?.let { Path.of(it) }
        AppContext(configDir?: configFile)
    }.getOrElse {
        logger.error(it) { "Failed to start the app" }
        exitProcess(1)
    }
}
