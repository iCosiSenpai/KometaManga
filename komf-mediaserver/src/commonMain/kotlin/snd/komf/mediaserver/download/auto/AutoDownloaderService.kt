package snd.komf.mediaserver.download.auto

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import snd.komf.mediaserver.download.AutoDownloaderConfig
import snd.komf.mediaserver.download.DownloadService
import snd.komf.sources.MangaSourcesModule
import kotlin.time.Clock
import kotlin.time.Duration.Companion.hours
import kotlin.time.Instant

private val logger = KotlinLogging.logger {}

class AutoDownloaderService(
    private val ruleRepository: AutoDownloaderRuleRepository,
    private val downloadService: DownloadService,
    private val sourcesModule: MangaSourcesModule,
    private val config: AutoDownloaderConfig,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var schedulerJob: Job? = null

    @Volatile
    var lastCheck: Instant? = null
        private set

    val nextCheck: Instant?
        get() = lastCheck?.plus(config.intervalHours.hours)

    fun start() {
        if (!config.enabled) {
            logger.info { "Auto-downloader is disabled" }
            return
        }

        schedulerJob = scope.launch {
            logger.info { "Auto-downloader started, checking every ${config.intervalHours}h" }
            while (isActive) {
                try {
                    checkForNewChapters()
                } catch (e: Exception) {
                    logger.error(e) { "Auto-downloader check failed" }
                }
                delay(config.intervalHours.hours)
            }
        }
    }

    suspend fun stop() {
        schedulerJob?.cancelAndJoin()
        schedulerJob = null
    }

    suspend fun checkNow() {
        checkForNewChapters()
    }

    suspend fun checkForNewChapters() {
        val rules = ruleRepository.findEnabled()
        if (rules.isEmpty()) {
            logger.debug { "No auto-downloader rules enabled" }
            lastCheck = Clock.System.now()
            return
        }

        logger.info { "Checking ${rules.size} auto-downloader rules for new chapters" }

        for (rule in rules) {
            try {
                processRule(rule)
            } catch (e: Exception) {
                logger.error(e) { "Failed to process auto-download rule for '${rule.mangaTitle}'" }
            }
        }

        lastCheck = Clock.System.now()
    }

    private suspend fun processRule(rule: AutoDownloaderRuleRecord) {
        val source = sourcesModule.getSource(rule.sourceId)
        val chapters = source.getChapters(rule.mangaId, rule.language)

        val filteredChapters = chapters.filter { chapter ->
            // Filter by scanlator if specified
            if (rule.scanlator != null && chapter.scanlator != rule.scanlator) return@filter false

            // Filter by chapter number — only download chapters after the last known
            if (rule.lastChapterNumber != null) {
                val chapterNum = chapter.chapterNumber.toDoubleOrNull() ?: return@filter false
                if (chapterNum <= rule.lastChapterNumber) return@filter false
            }

            true
        }

        if (filteredChapters.isEmpty()) {
            logger.debug { "No new chapters for '${rule.mangaTitle}'" }
            return
        }

        logger.info { "Found ${filteredChapters.size} new chapters for '${rule.mangaTitle}'" }

        downloadService.downloadChapters(
            sourceId = rule.sourceId,
            mangaId = rule.mangaId,
            chapterIds = filteredChapters.map { it.id },
            libraryPath = rule.komgaLibraryPath,
            libraryId = rule.komgaLibraryId,
        )

        // Update last chapter number
        val maxChapter = filteredChapters
            .mapNotNull { it.chapterNumber.toDoubleOrNull() }
            .maxOrNull()

        if (maxChapter != null) {
            ruleRepository.updateLastChapter(rule.id, maxChapter)
        }
    }

    // CRUD for rules
    fun getRules() = ruleRepository.findAll()
    fun getRule(id: String) = ruleRepository.get(AutoDownloaderRuleId(id))

    fun createRule(
        sourceId: snd.komf.sources.MangaSourceId,
        mangaId: String,
        mangaTitle: String,
        language: String? = null,
        scanlator: String? = null,
        lastChapterNumber: Double? = null,
        enabled: Boolean = true,
        komgaLibraryId: String? = null,
        komgaLibraryPath: String? = null,
    ): AutoDownloaderRuleRecord {
        val rule = AutoDownloaderRuleRecord(
            id = AutoDownloaderRuleId.generate(),
            sourceId = sourceId,
            mangaId = mangaId,
            mangaTitle = mangaTitle,
            language = language,
            scanlator = scanlator,
            lastChapterNumber = lastChapterNumber,
            enabled = enabled,
            komgaLibraryId = komgaLibraryId,
            komgaLibraryPath = komgaLibraryPath,
        )
        ruleRepository.save(rule)
        return rule
    }

    fun updateRule(
        id: String,
        language: String? = null,
        scanlator: String? = null,
        lastChapterNumber: Double? = null,
        enabled: Boolean? = null,
        komgaLibraryId: String? = null,
        komgaLibraryPath: String? = null,
    ): AutoDownloaderRuleRecord {
        val existing = ruleRepository.get(AutoDownloaderRuleId(id))
            ?: throw NoSuchElementException("Auto-downloader rule $id not found")

        val updated = existing.copy(
            language = language ?: existing.language,
            scanlator = scanlator ?: existing.scanlator,
            lastChapterNumber = lastChapterNumber ?: existing.lastChapterNumber,
            enabled = enabled ?: existing.enabled,
            komgaLibraryId = komgaLibraryId ?: existing.komgaLibraryId,
            komgaLibraryPath = komgaLibraryPath ?: existing.komgaLibraryPath,
        )
        ruleRepository.save(updated)
        return updated
    }

    fun deleteRule(id: String) {
        ruleRepository.delete(AutoDownloaderRuleId(id))
    }

    fun getStatus() = AutoDownloaderStatus(
        enabled = config.enabled,
        lastCheck = lastCheck,
        nextCheck = nextCheck,
        activeRulesCount = ruleRepository.findEnabled().size,
    )
}

data class AutoDownloaderStatus(
    val enabled: Boolean,
    val lastCheck: Instant?,
    val nextCheck: Instant?,
    val activeRulesCount: Int,
)
