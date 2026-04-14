package snd.komf.mediaserver.download

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import snd.komf.sources.MangaSource
import snd.komf.sources.MangaSourceId
import snd.komf.sources.model.ChapterPage
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaDetails
import snd.komf.sources.model.MangaSearchResult
import snd.komf.sources.model.SourceHealthStatus
import java.io.ByteArrayInputStream
import java.nio.file.Files
import java.util.zip.ZipInputStream
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class ChapterDownloaderTest {

    private val fakePngBytes = ByteArray(100) { it.toByte() }

    private fun createMockHttpClient(): HttpClient {
        return HttpClient(MockEngine) {
            engine {
                addHandler { request ->
                    respond(
                        content = fakePngBytes,
                        status = HttpStatusCode.OK,
                        headers = headersOf(HttpHeaders.ContentType, "image/png"),
                    )
                }
            }
        }
    }

    private fun createDownloader(compression: Boolean = false): ChapterDownloader {
        return ChapterDownloader(
            httpClient = createMockHttpClient(),
            downloadConfig = DownloadConfig(
                downloadDir = "./test-downloads",
                cbzCompression = compression,
                concurrentPageDownloads = 2,
            ),
        )
    }

    private val testManga = MangaDetails(
        id = "manga-1",
        title = "One Piece",
        description = "A pirate adventure",
        authors = listOf("Eiichiro Oda"),
        artists = listOf("Eiichiro Oda"),
        genres = listOf("Action", "Adventure"),
        sourceId = MangaSourceId.MANGADEX,
    )

    private val testChapter = MangaChapter(
        id = "chapter-1",
        mangaId = "manga-1",
        title = "Romance Dawn",
        chapterNumber = "1",
        volumeNumber = "1",
        language = "en",
        scanlator = "Official",
        sourceId = MangaSourceId.MANGADEX,
    )

    private fun createFakeSource(pages: List<ChapterPage>) = object : MangaSource {
        override fun sourceId() = MangaSourceId.MANGADEX
        override fun sourceName() = "Test"
        override fun supportedLanguages() = setOf("en")
        override suspend fun searchManga(query: String, limit: Int, language: String?) = emptyList<MangaSearchResult>()
        override suspend fun getMangaDetails(mangaId: String) = testManga
        override suspend fun getChapters(mangaId: String, language: String?) = listOf(testChapter)
        override suspend fun getChapterPages(chapterId: String) = pages
        override suspend fun healthCheck() = SourceHealthStatus(snd.komf.sources.model.HealthStatus.GREEN)
    }

    @Test
    fun `downloadChapter creates valid CBZ with correct pages`() = runTest {
        val downloader = createDownloader()
        val tempDir = Files.createTempDirectory("komf-test-dl")
        try {
            val pages = listOf(
                ChapterPage(index = 0, imageUrl = "https://example.com/page1.png"),
                ChapterPage(index = 1, imageUrl = "https://example.com/page2.png"),
                ChapterPage(index = 2, imageUrl = "https://example.com/page3.png"),
            )

            val source = createFakeSource(pages)
            val result = downloader.downloadChapter(source, testManga, testChapter, tempDir)

            // Verify result
            assertEquals(3, result.pageCount)
            assertTrue(result.fileSize > 0)
            assertTrue(Files.exists(result.filePath))
            assertTrue(result.filePath.toString().endsWith(".cbz"))

            // Verify CBZ contents
            val entries = mutableListOf<String>()
            ZipInputStream(ByteArrayInputStream(Files.readAllBytes(result.filePath))).use { zis ->
                var entry = zis.nextEntry
                while (entry != null) {
                    entries.add(entry.name)
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
            }

            assertTrue(entries.contains("ComicInfo.xml"), "CBZ should contain ComicInfo.xml")
            assertTrue(entries.contains("0001.png"), "CBZ should contain page 0001.png")
            assertTrue(entries.contains("0002.png"), "CBZ should contain page 0002.png")
            assertTrue(entries.contains("0003.png"), "CBZ should contain page 0003.png")
            assertEquals(4, entries.size, "CBZ should have ComicInfo.xml + 3 pages")
        } finally {
            tempDir.toFile().deleteRecursively()
        }
    }

    @Test
    fun `downloadChapter generates correct ComicInfo xml`() = runTest {
        val downloader = createDownloader()
        val tempDir = Files.createTempDirectory("komf-test-ci")
        try {
            val pages = listOf(
                ChapterPage(index = 0, imageUrl = "https://example.com/page1.png"),
            )

            val source = createFakeSource(pages)
            val result = downloader.downloadChapter(source, testManga, testChapter, tempDir)

            // Extract ComicInfo.xml
            var comicInfoXml: String? = null
            ZipInputStream(ByteArrayInputStream(Files.readAllBytes(result.filePath))).use { zis ->
                var entry = zis.nextEntry
                while (entry != null) {
                    if (entry.name == "ComicInfo.xml") {
                        comicInfoXml = zis.readBytes().toString(Charsets.UTF_8)
                    }
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
            }

            assertNotNull(comicInfoXml, "ComicInfo.xml should exist in CBZ")
            val xml = comicInfoXml!!
            assertTrue(xml.contains("<Series>One Piece</Series>"))
            assertTrue(xml.contains("<Number>1</Number>"))
            assertTrue(xml.contains("<Volume>1</Volume>"))
            assertTrue(xml.contains("<Title>Romance Dawn</Title>"))
            assertTrue(xml.contains("<Writer>Eiichiro Oda</Writer>"))
            assertTrue(xml.contains("<Penciller>Eiichiro Oda</Penciller>"))
            assertTrue(xml.contains("<Summary>A pirate adventure</Summary>"))
            assertTrue(xml.contains("<PageCount>1</PageCount>"))
            assertTrue(xml.contains("<Manga>Yes</Manga>"))
            assertTrue(xml.contains("<LanguageISO>en</LanguageISO>"))
            assertTrue(xml.contains("<Genre>Action, Adventure</Genre>"))
        } finally {
            tempDir.toFile().deleteRecursively()
        }
    }

    @Test
    fun `downloadChapter builds correct file path with volume and chapter`() = runTest {
        val downloader = createDownloader()
        val tempDir = Files.createTempDirectory("komf-test-path")
        try {
            val pages = listOf(
                ChapterPage(index = 0, imageUrl = "https://example.com/page1.png"),
            )

            val source = createFakeSource(pages)
            val result = downloader.downloadChapter(source, testManga, testChapter, tempDir)

            val fileName = result.filePath.fileName.toString()
            assertTrue(fileName.contains("One Piece"), "Filename should contain manga title")
            assertTrue(fileName.contains("v1"), "Filename should contain volume number")
            assertTrue(fileName.contains("c1"), "Filename should contain chapter number")
            assertTrue(fileName.contains("Romance Dawn"), "Filename should contain chapter title")
            assertTrue(fileName.endsWith(".cbz"), "File should have .cbz extension")

            // Verify series directory
            val parentDir = result.filePath.parent.fileName.toString()
            assertEquals("One Piece", parentDir, "Parent directory should be manga title")
        } finally {
            tempDir.toFile().deleteRecursively()
        }
    }

    @Test
    fun `downloadChapter handles chapter without volume and title`() = runTest {
        val downloader = createDownloader()
        val tempDir = Files.createTempDirectory("komf-test-novolume")
        try {
            val chapterNoVolume = MangaChapter(
                id = "ch-2",
                mangaId = "manga-1",
                title = null,
                chapterNumber = "42",
                volumeNumber = null,
                language = "it",
                sourceId = MangaSourceId.MANGADEX,
            )

            val pages = listOf(
                ChapterPage(index = 0, imageUrl = "https://example.com/page1.png"),
            )

            val source = createFakeSource(pages)
            val result = downloader.downloadChapter(source, testManga, chapterNoVolume, tempDir)

            val fileName = result.filePath.fileName.toString()
            assertTrue(fileName.contains("c42"), "Filename should contain chapter number")
            assertTrue(!fileName.contains("v"), "Filename should not contain volume prefix")
            assertTrue(fileName.endsWith(".cbz"))
        } finally {
            tempDir.toFile().deleteRecursively()
        }
    }

    @Test
    fun `downloadChapter sanitizes special characters in manga title`() = runTest {
        val downloader = createDownloader()
        val tempDir = Files.createTempDirectory("komf-test-sanitize")
        try {
            val mangaWithSpecialChars = testManga.copy(
                title = "Re:Zero / Starting Life * Another \"World\" <Side>"
            )

            val pages = listOf(
                ChapterPage(index = 0, imageUrl = "https://example.com/page1.png"),
            )

            val source = object : MangaSource {
                override fun sourceId() = MangaSourceId.MANGADEX
                override fun sourceName() = "Test"
                override fun supportedLanguages() = setOf("en")
                override suspend fun searchManga(query: String, limit: Int, language: String?) = emptyList<MangaSearchResult>()
                override suspend fun getMangaDetails(mangaId: String) = mangaWithSpecialChars
                override suspend fun getChapters(mangaId: String, language: String?) = listOf(testChapter)
                override suspend fun getChapterPages(chapterId: String) = pages
                override suspend fun healthCheck() = SourceHealthStatus(snd.komf.sources.model.HealthStatus.GREEN)
            }

            val result = downloader.downloadChapter(source, mangaWithSpecialChars, testChapter, tempDir)

            val fileName = result.filePath.fileName.toString()
            assertTrue(!fileName.contains("/"), "Filename should not contain /")
            assertTrue(!fileName.contains("*"), "Filename should not contain *")
            assertTrue(!fileName.contains("\""), "Filename should not contain quotes")
            assertTrue(!fileName.contains("<"), "Filename should not contain <")
            assertTrue(!fileName.contains(">"), "Filename should not contain >")
            assertTrue(Files.exists(result.filePath), "File should exist on disk")
        } finally {
            tempDir.toFile().deleteRecursively()
        }
    }

    @Test
    fun `downloadChapter reports progress via callback`() = runTest {
        val downloader = createDownloader()
        val tempDir = Files.createTempDirectory("komf-test-progress")
        try {
            val pages = listOf(
                ChapterPage(index = 0, imageUrl = "https://example.com/page1.png"),
                ChapterPage(index = 1, imageUrl = "https://example.com/page2.png"),
                ChapterPage(index = 2, imageUrl = "https://example.com/page3.png"),
                ChapterPage(index = 3, imageUrl = "https://example.com/page4.png"),
                ChapterPage(index = 4, imageUrl = "https://example.com/page5.png"),
            )

            val progressReports = mutableListOf<Pair<Int, Int>>()
            val source = createFakeSource(pages)

            downloader.downloadChapter(source, testManga, testChapter, tempDir) { current, total ->
                progressReports.add(current to total)
            }

            assertEquals(5, progressReports.size, "Should report progress for each page")
            assertTrue(progressReports.all { it.second == 5 }, "Total pages should always be 5")
            // All pages completed (order may vary due to concurrency)
            assertEquals(
                setOf(1, 2, 3, 4, 5),
                progressReports.map { it.first }.toSet(),
                "All page indices should be reported",
            )
        } finally {
            tempDir.toFile().deleteRecursively()
        }
    }

    @Test
    fun `downloadChapter with compression creates valid CBZ`() = runTest {
        val downloader = createDownloader(compression = true)
        val tempDir = Files.createTempDirectory("komf-test-compress")
        try {
            val pages = listOf(
                ChapterPage(index = 0, imageUrl = "https://example.com/page1.png"),
                ChapterPage(index = 1, imageUrl = "https://example.com/page2.png"),
            )

            val source = createFakeSource(pages)
            val result = downloader.downloadChapter(source, testManga, testChapter, tempDir)

            assertTrue(result.fileSize > 0)

            // Verify CBZ is still valid and readable
            val entries = mutableListOf<String>()
            ZipInputStream(ByteArrayInputStream(Files.readAllBytes(result.filePath))).use { zis ->
                var entry = zis.nextEntry
                while (entry != null) {
                    entries.add(entry.name)
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
            }

            assertEquals(3, entries.size, "CBZ should have ComicInfo.xml + 2 pages")
        } finally {
            tempDir.toFile().deleteRecursively()
        }
    }

    @Test
    fun `downloadChapter uses correct image extensions from content type`() = runTest {
        val webpBytes = ByteArray(50) { it.toByte() }

        val httpClient = HttpClient(MockEngine) {
            engine {
                addHandler { request ->
                    val url = request.url.toString()
                    when {
                        url.contains("page1") -> respond(
                            content = fakePngBytes,
                            status = HttpStatusCode.OK,
                            headers = headersOf(HttpHeaders.ContentType, "image/png"),
                        )
                        url.contains("page2") -> respond(
                            content = webpBytes,
                            status = HttpStatusCode.OK,
                            headers = headersOf(HttpHeaders.ContentType, "image/webp"),
                        )
                        else -> respond(
                            content = fakePngBytes,
                            status = HttpStatusCode.OK,
                            headers = headersOf(HttpHeaders.ContentType, "image/jpeg"),
                        )
                    }
                }
            }
        }

        val downloader = ChapterDownloader(
            httpClient = httpClient,
            downloadConfig = DownloadConfig(concurrentPageDownloads = 1),
        )

        val tempDir = Files.createTempDirectory("komf-test-ext")
        try {
            val pages = listOf(
                ChapterPage(index = 0, imageUrl = "https://example.com/page1"),
                ChapterPage(index = 1, imageUrl = "https://example.com/page2"),
                ChapterPage(index = 2, imageUrl = "https://example.com/page3"),
            )

            val source = createFakeSource(pages)
            val result = downloader.downloadChapter(source, testManga, testChapter, tempDir)

            val entries = mutableListOf<String>()
            ZipInputStream(ByteArrayInputStream(Files.readAllBytes(result.filePath))).use { zis ->
                var entry = zis.nextEntry
                while (entry != null) {
                    entries.add(entry.name)
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
            }

            assertTrue(entries.contains("0001.png"), "First page should be PNG")
            assertTrue(entries.contains("0002.webp"), "Second page should be WebP")
            assertTrue(entries.contains("0003.jpg"), "Third page should be JPG (default)")
        } finally {
            tempDir.toFile().deleteRecursively()
        }
    }

    @Test
    fun `ComicInfo xml escapes special characters`() = runTest {
        val downloader = createDownloader()
        val tempDir = Files.createTempDirectory("komf-test-escape")
        try {
            val mangaWithXmlChars = testManga.copy(
                title = "Attack & Titan <Season 1>",
                description = "Eren's \"fight\" against <titans>",
            )
            val chapterWithXmlTitle = testChapter.copy(
                title = "To You, 2000 Years & Beyond",
            )

            val pages = listOf(
                ChapterPage(index = 0, imageUrl = "https://example.com/page1.png"),
            )

            val source = object : MangaSource {
                override fun sourceId() = MangaSourceId.MANGADEX
                override fun sourceName() = "Test"
                override fun supportedLanguages() = setOf("en")
                override suspend fun searchManga(query: String, limit: Int, language: String?) = emptyList<MangaSearchResult>()
                override suspend fun getMangaDetails(mangaId: String) = mangaWithXmlChars
                override suspend fun getChapters(mangaId: String, language: String?) = listOf(chapterWithXmlTitle)
                override suspend fun getChapterPages(chapterId: String) = pages
                override suspend fun healthCheck() = SourceHealthStatus(snd.komf.sources.model.HealthStatus.GREEN)
            }

            val result = downloader.downloadChapter(source, mangaWithXmlChars, chapterWithXmlTitle, tempDir)

            // Extract ComicInfo.xml
            var comicInfoXml: String? = null
            ZipInputStream(ByteArrayInputStream(Files.readAllBytes(result.filePath))).use { zis ->
                var entry = zis.nextEntry
                while (entry != null) {
                    if (entry.name == "ComicInfo.xml") {
                        comicInfoXml = zis.readBytes().toString(Charsets.UTF_8)
                    }
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
            }

            val xml = comicInfoXml!!
            assertTrue(xml.contains("Attack &amp; Titan &lt;Season 1&gt;"), "Title should escape & and <> chars")
            assertTrue(xml.contains("Eren&apos;s &quot;fight&quot;"), "Description should escape quotes/apostrophes")
            assertTrue(xml.contains("To You, 2000 Years &amp; Beyond"), "Chapter title should escape &")
        } finally {
            tempDir.toFile().deleteRecursively()
        }
    }
}
