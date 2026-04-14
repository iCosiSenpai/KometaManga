package snd.komf.app.config

import com.charleskorn.kaml.Yaml
import io.github.oshai.kotlinlogging.KotlinLogging
import java.nio.file.Path
import kotlin.io.path.copyTo
import kotlin.io.path.exists
import kotlin.io.path.isDirectory
import kotlin.io.path.isWritable
import kotlin.io.path.writeText
import kotlin.text.Charsets.UTF_8

private val logger = KotlinLogging.logger {}

class ConfigWriter(private val yaml: Yaml) {

    @Synchronized
    fun writeConfig(config: AppConfig, path: Path) {
        checkWriteAccess(path)
        val target = if (path.isDirectory()) path.resolve("application.yml") else path
        backupIfExists(target)
        target.writeText(yaml.encodeToString(AppConfig.serializer(), config), UTF_8)
    }

    @Synchronized
    fun writeConfigToDefaultPath(config: AppConfig) {
        val filePath = Path.of(".").toAbsolutePath().normalize().resolve("application.yml")
        if (filePath.exists())
            checkWriteAccess(filePath)

        backupIfExists(filePath)
        filePath.writeText(yaml.encodeToString(AppConfig.serializer(), config), UTF_8)
    }

    private fun backupIfExists(path: Path) {
        if (path.exists()) {
            val backup = path.resolveSibling("${path.fileName}.bak")
            try {
                path.copyTo(backup, overwrite = true)
                logger.info { "Config backup saved to $backup" }
            } catch (e: Exception) {
                logger.warn(e) { "Failed to create config backup at $backup" }
            }
        }
    }

    private fun checkWriteAccess(path: Path) {
        if (path.isWritable().not()) throw AccessDeniedException(file = path.toFile(), reason = "No write access to config file")
    }
}