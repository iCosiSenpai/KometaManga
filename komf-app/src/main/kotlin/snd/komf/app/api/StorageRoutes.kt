package snd.komf.app.api

import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.serialization.Serializable
import snd.komf.app.config.AppConfig
import java.io.File
import java.nio.file.Files
import kotlin.io.path.Path

@Serializable
data class StorageStats(
    val downloadDir: String,
    val totalBytes: Long,
    val usableBytes: Long,
    val usedBytes: Long,
    val fileCount: Int,
    val folderCount: Int,
)

class StorageRoutes(
    private val config: Flow<AppConfig>,
) {
    fun registerRoutes(routing: Route) {
        routing.get("/storage/stats") {
            val downloadDir = config.first().download.downloadDir
            val dir = File(downloadDir)

            val store = Files.getFileStore(Path(dir.absolutePath))
            val totalBytes = store.totalSpace
            val usableBytes = store.usableSpace
            val usedBytes = totalBytes - usableBytes

            var fileCount = 0
            var folderCount = 0
            if (dir.exists() && dir.isDirectory) {
                dir.walkTopDown().forEach { f ->
                    if (f == dir) return@forEach
                    if (f.isFile) fileCount++
                    else if (f.isDirectory) folderCount++
                }
            }

            call.respond(
                StorageStats(
                    downloadDir = dir.absolutePath,
                    totalBytes = totalBytes,
                    usableBytes = usableBytes,
                    usedBytes = usedBytes,
                    fileCount = fileCount,
                    folderCount = folderCount,
                )
            )
        }
    }
}
