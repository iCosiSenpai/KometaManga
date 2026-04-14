package snd.komf.mediaserver.download

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.headers
import io.ktor.client.statement.readRawBytes
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import snd.komf.sources.MangaSource
import snd.komf.sources.model.ChapterPage
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaDetails
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.nio.file.Path
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

private val logger = KotlinLogging.logger {}

data class DownloadedPage(
    val index: Int,
    val data: ByteArray,
    val extension: String,
)

data class ChapterDownloadResult(
    val filePath: Path,
    val fileSize: Long,
    val pageCount: Int,
)

class ChapterDownloader(
    private val httpClient: HttpClient,
    private val downloadConfig: DownloadConfig,
) {

    suspend fun downloadChapter(
        source: MangaSource,
        manga: MangaDetails,
        chapter: MangaChapter,
        outputDir: Path,
        onPageDownloaded: suspend (currentPage: Int, totalPages: Int) -> Unit = { _, _ -> },
    ): ChapterDownloadResult = withContext(Dispatchers.IO) {
        val pages = source.getChapterPages(chapter.id)
        if (pages.isEmpty()) {
            throw IllegalStateException("No pages found for chapter ${chapter.chapterNumber}")
        }

        logger.info { "Downloading ${pages.size} pages for ${manga.title} ch.${chapter.chapterNumber}" }

        val downloadedPages = downloadPages(pages, onPageDownloaded)
        val cbzPath = buildCbzPath(outputDir, manga, chapter)

        Files.createDirectories(cbzPath.parent)
        val fileSize = packageToCbz(downloadedPages, cbzPath, manga, chapter)

        logger.info { "Created CBZ: $cbzPath (${fileSize / 1024}KB, ${downloadedPages.size} pages)" }

        ChapterDownloadResult(
            filePath = cbzPath,
            fileSize = fileSize,
            pageCount = downloadedPages.size,
        )
    }

    private suspend fun downloadPages(
        pages: List<ChapterPage>,
        onPageDownloaded: suspend (currentPage: Int, totalPages: Int) -> Unit,
    ): List<DownloadedPage> = coroutineScope {
        val semaphore = Semaphore(downloadConfig.concurrentPageDownloads)
        val totalPages = pages.size

        pages.map { page ->
            async {
                semaphore.withPermit {
                    val data = downloadPage(page)
                    onPageDownloaded(page.index + 1, totalPages)
                    data
                }
            }
        }.awaitAll()
    }

    private suspend fun downloadPage(page: ChapterPage): DownloadedPage {
        val response = httpClient.get(page.imageUrl) {
            headers {
                page.headers.forEach { (key, value) -> append(key, value) }
            }
        }
        val bytes = response.readRawBytes()
        val extension = guessExtension(page.imageUrl, response.headers["Content-Type"])

        return DownloadedPage(
            index = page.index,
            data = bytes,
            extension = extension,
        )
    }

    private fun buildCbzPath(outputDir: Path, manga: MangaDetails, chapter: MangaChapter): Path {
        val sanitizedTitle = sanitizeFilename(manga.title)
        val seriesDir = outputDir.resolve(sanitizedTitle)

        val chapterFileName = buildString {
            append(sanitizedTitle)
            val vol = chapter.volumeNumber
            if (vol != null) {
                append(" v$vol")
            }
            append(" c${chapter.chapterNumber}")
            val chTitle = chapter.title
            if (chTitle != null) {
                append(" - ${sanitizeFilename(chTitle)}")
            }
            append(".cbz")
        }

        return seriesDir.resolve(chapterFileName)
    }

    private suspend fun packageToCbz(
        pages: List<DownloadedPage>,
        outputPath: Path,
        manga: MangaDetails,
        chapter: MangaChapter,
    ): Long = withContext(Dispatchers.IO) {
        val sortedPages = pages.sortedBy { it.index }

        val comicInfoXml = generateComicInfo(manga, chapter, sortedPages.size)

        outputPath.toFile().outputStream().buffered().use { fos ->
            ZipOutputStream(fos).use { zos ->
                if (downloadConfig.cbzCompression) {
                    zos.setLevel(6)
                } else {
                    zos.setLevel(ZipOutputStream.STORED)
                }

                // Add ComicInfo.xml first
                val comicInfoBytes = comicInfoXml.toByteArray(Charsets.UTF_8)
                val comicInfoEntry = ZipEntry("ComicInfo.xml")
                if (!downloadConfig.cbzCompression) {
                    comicInfoEntry.method = ZipEntry.STORED
                    comicInfoEntry.size = comicInfoBytes.size.toLong()
                    comicInfoEntry.compressedSize = comicInfoBytes.size.toLong()
                    comicInfoEntry.crc = CRC32().apply { update(comicInfoBytes) }.value
                }
                zos.putNextEntry(comicInfoEntry)
                zos.write(comicInfoBytes)
                zos.closeEntry()

                // Add pages
                for (page in sortedPages) {
                    val paddedIndex = String.format("%04d", page.index + 1)
                    val entry = ZipEntry("$paddedIndex.${page.extension}")
                    if (!downloadConfig.cbzCompression) {
                        entry.method = ZipEntry.STORED
                        entry.size = page.data.size.toLong()
                        entry.compressedSize = page.data.size.toLong()
                        entry.crc = CRC32().apply { update(page.data) }.value
                    }
                    zos.putNextEntry(entry)
                    zos.write(page.data)
                    zos.closeEntry()
                }
            }
        }

        Files.size(outputPath)
    }

    private fun generateComicInfo(manga: MangaDetails, chapter: MangaChapter, pageCount: Int): String {
        return buildString {
            appendLine("""<?xml version="1.0" encoding="utf-8"?>""")
            appendLine("<ComicInfo>")
            appendLine("  <Title>${escapeXml(chapter.title ?: "Chapter ${chapter.chapterNumber}")}</Title>")
            appendLine("  <Series>${escapeXml(manga.title)}</Series>")
            appendLine("  <Number>${escapeXml(chapter.chapterNumber)}</Number>")
            val vol = chapter.volumeNumber
            if (vol != null) {
                appendLine("  <Volume>${escapeXml(vol)}</Volume>")
            }
            if (manga.authors.isNotEmpty()) {
                appendLine("  <Writer>${escapeXml(manga.authors.first())}</Writer>")
            }
            if (manga.artists.isNotEmpty()) {
                appendLine("  <Penciller>${escapeXml(manga.artists.first())}</Penciller>")
            }
            val desc = manga.description
            if (desc != null) {
                appendLine("  <Summary>${escapeXml(desc)}</Summary>")
            }
            appendLine("  <PageCount>$pageCount</PageCount>")
            appendLine("  <Manga>Yes</Manga>")
            val lang = chapter.language
            if (lang != null) {
                appendLine("  <LanguageISO>${escapeXml(lang)}</LanguageISO>")
            }
            if (manga.genres.isNotEmpty()) {
                appendLine("  <Genre>${escapeXml(manga.genres.joinToString(", "))}</Genre>")
            }
            appendLine("</ComicInfo>")
        }
    }

    private fun escapeXml(text: String): String {
        return text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&apos;")
    }

    private fun sanitizeFilename(name: String): String {
        return name
            .replace(Regex("[\\\\/:*?\"<>|]"), "_")
            .replace(Regex("\\s+"), " ")
            .trim()
            .take(200)
    }

    private fun guessExtension(url: String, contentType: String?): String {
        return when {
            contentType?.contains("png") == true -> "png"
            contentType?.contains("webp") == true -> "webp"
            contentType?.contains("gif") == true -> "gif"
            url.contains(".png") -> "png"
            url.contains(".webp") -> "webp"
            url.contains(".gif") -> "gif"
            else -> "jpg"
        }
    }
}
