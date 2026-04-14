package snd.komf.sources.mangaworld

import com.fleeksoft.ksoup.nodes.Document
import com.fleeksoft.ksoup.nodes.Element
import snd.komf.sources.MangaSourceId
import snd.komf.sources.model.ChapterPage
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaDetails
import snd.komf.sources.model.MangaSearchResult
import snd.komf.sources.model.MangaStatus

object MangaWorldSourceMapper {

    private val chapterNumberRegex = Regex("""(?i)capitolo\s([0-9]+(?:\.[0-9]+)?)""")

    fun parseSearchResults(document: Document): List<MangaSearchResult> {
        return document.select("div.comics-grid .entry").mapNotNull { element ->
            val link = element.selectFirst("a") ?: return@mapNotNull null
            val url = link.attr("href").removeSuffix("/")
            val title = link.attr("title").takeIf { it.isNotBlank() }
                ?: link.text().takeIf { it.isNotBlank() }
                ?: return@mapNotNull null
            val coverUrl = element.selectFirst("a.thumb img")?.attr("src")

            // Extract manga ID from URL (e.g., /manga/12345/name)
            val id = url.substringAfterLast("/manga/").substringBefore("/")
                .takeIf { it.isNotBlank() } ?: url

            MangaSearchResult(
                id = url, // Use full URL path as ID
                title = title,
                coverUrl = coverUrl,
                sourceId = MangaSourceId.MANGAWORLD,
            )
        }
    }

    fun parseMangaDetails(document: Document, mangaId: String): MangaDetails {
        val infoElement = document.selectFirst("div.comic-info")

        val title = document.selectFirst("div.comic-info h1")?.text()
            ?: document.selectFirst("title")?.text()?.substringBefore(" - MangaWorld")
            ?: "Unknown"

        val author = infoElement?.selectFirst("a[href*=/archive?author=]")?.text()
        val artist = infoElement?.selectFirst("a[href*=/archive?artist=]")?.text()
        val coverUrl = infoElement?.selectFirst(".thumb > img")?.attr("src")

        val description = document.selectFirst("div#noidungm")?.text()

        val genres = infoElement?.select("div.meta-data a.badge")
            ?.map { it.text() } ?: emptyList()

        val statusText = infoElement?.selectFirst("a[href*=/archive?status=]")?.text()
        val status = parseStatus(statusText)

        val altTitle = document.selectFirst("div.meta-data > div")?.text()
        val alternativeTitles = if (altTitle != null && altTitle.contains("Titoli alternativi")) {
            listOf(altTitle.substringAfter(":").trim())
        } else emptyList()

        return MangaDetails(
            id = mangaId,
            title = title,
            alternativeTitles = alternativeTitles,
            description = description,
            coverUrl = coverUrl,
            authors = listOfNotNull(author),
            artists = listOfNotNull(artist),
            genres = genres,
            status = status,
            sourceId = MangaSourceId.MANGAWORLD,
        )
    }

    fun parseChapters(document: Document, mangaId: String): List<MangaChapter> {
        return document.select(".chapters-wrapper .chapter").mapNotNull { element ->
            parseChapter(element, mangaId)
        }
    }

    private fun parseChapter(element: Element, mangaId: String): MangaChapter? {
        val link = element.selectFirst("a.chap") ?: return null
        val url = link.attr("href")
        val name = element.selectFirst("span.d-inline-block")?.text() ?: ""

        val chapterNumber = chapterNumberRegex.find(name)
            ?.groups?.get(1)?.value ?: "0"

        return MangaChapter(
            id = url, // Use full URL as ID
            mangaId = mangaId,
            title = name,
            chapterNumber = chapterNumber,
            language = "it",
            sourceId = MangaSourceId.MANGAWORLD,
        )
    }

    fun parsePages(document: Document): List<ChapterPage> {
        return document.select("div#page img.page-image").mapIndexed { index, element ->
            ChapterPage(
                index = index,
                imageUrl = element.attr("src"),
                headers = mapOf("Referer" to "https://www.mangaworld.mx/"),
            )
        }
    }

    private fun parseStatus(text: String?): MangaStatus {
        if (text.isNullOrBlank()) return MangaStatus.UNKNOWN
        return when (text.lowercase()) {
            "in corso" -> MangaStatus.ONGOING
            "finito" -> MangaStatus.COMPLETED
            "in pausa" -> MangaStatus.HIATUS
            "cancellato" -> MangaStatus.CANCELLED
            else -> MangaStatus.UNKNOWN
        }
    }
}
