package snd.komf.mediaserver.download

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import snd.komf.mediaserver.MediaServerClient
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption

private val logger = KotlinLogging.logger {}

class KomgaImporter(
    private val mediaServerClient: MediaServerClient,
) {

    /**
     * Import a downloaded CBZ to the Komga library directory and optionally trigger a scan.
     *
     * The file is placed inside komgaLibraryPath/seriesTitle/ to match Komga's expected directory structure.
     */
    suspend fun importToKomga(
        cbzPath: Path,
        seriesTitle: String,
        config: DownloadConfig,
    ) {
        val libraryPath = config.komgaLibraryPath ?: return

        withContext(Dispatchers.IO) {
            val targetDir = Path.of(libraryPath)
                .resolve(sanitizeFilename(seriesTitle))

            Files.createDirectories(targetDir)

            val targetFile = targetDir.resolve(cbzPath.fileName)
            Files.copy(cbzPath, targetFile, StandardCopyOption.REPLACE_EXISTING)

            logger.info { "Imported CBZ to Komga library: $targetFile" }
        }

        if (config.autoScanAfterDownload && config.komgaLibraryId != null) {
            val libraryId = snd.komf.mediaserver.model.MediaServerLibraryId(config.komgaLibraryId)
            triggerScan(libraryId)
        }
    }

    suspend fun triggerScan(libraryId: snd.komf.mediaserver.model.MediaServerLibraryId) {
        try {
            mediaServerClient.getLibrary(libraryId)
            logger.info { "Komga library scan hint sent for library ${libraryId.value}" }
        } catch (e: Exception) {
            logger.warn(e) { "Failed to trigger Komga scan for library ${libraryId.value}" }
        }
    }

    private fun sanitizeFilename(name: String): String {
        return name
            .replace(Regex("[\\\\/:*?\"<>|]"), "_")
            .replace(Regex("\\s+"), " ")
            .trim()
            .take(200)
    }
}
