package snd.komf.sources.mangapill

import com.fleeksoft.ksoup.nodes.Document
import snd.komf.sources.MangaSourceId
import snd.komf.sources.model.ChapterPage
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaDetails
import snd.komf.sources.model.MangaSearchResult
import snd.komf.sources.model.MangaStatus

private const val BASE_URL = "https://mangapill.com"

object MangapillSourceMapper {

    private val chapterNumberRegex = Regex("""chapter[- ](\d+(?:\.\d+)?)""", RegexOption.IGNORE_CASE)

    fun parseSearchResults(document: Document): List<MangaSearchResult> {
        return document.select(".grid > div:not([class])").mapNotNull { element ->
            val link = element.selectFirst("a") ?: return@mapNotNull null
            val url = link.attr("href")
            val title = element.selectFirst("div[class] > a")?.text()
                ?: element.selectFirst("a:not(:first-child)")?.text()
                ?: return@mapNotNull null
            val coverUrl = element.selectFirst("img")?.let { img ->
                img.attr("data-src").takeIf { it.isNotBlank() }
                    ?: img.attr("src").takeIf { it.isNotBlank() }
            }

            MangaSearchResult(
                id = url,
                title = title.trim(),
                coverUrl = coverUrl,
                sourceId = MangaSourceId.MANGAPILL,
            )
        }
    }

    fun parseMangaDetails(document: Document, mangaId: String): MangaDetails {
        val container = document.selectFirst("div.container")

        val title = document.selectFirst("h1")?.text()
            ?: document.selectFirst("title")?.text()?.substringBefore(" - Mangapill")
            ?: "Unknown"

        val coverUrl = container?.selectFirst("div:first-child > div:first-child > img")?.let { img ->
            img.attr("data-src").takeIf { it.isNotBlank() }
                ?: img.attr("src").takeIf { it.isNotBlank() }
        }

        val description = container
            ?.selectFirst("div:first-child > div:last-child > div:nth-child(2) > p")
            ?.text()

        val genres = document.select("a[href*=genre]").map { it.text() }

        val statusText = container
            ?.selectFirst("div div:first-child > div:last-child > div:nth-child(3) > div:nth-child(2) > div")
            ?.text()
        val status = parseStatus(statusText)

        return MangaDetails(
            id = mangaId,
            title = title,
            description = description,
            coverUrl = coverUrl,
            genres = genres,
            status = status,
            sourceId = MangaSourceId.MANGAPILL,
        )
    }

    fun parseChapters(document: Document, mangaId: String): List<MangaChapter> {
        return document.select("#chapters > div > a").mapNotNull { element ->
            val url = element.attr("href")
            val name = element.text().trim()

            val chapterNumber = chapterNumberRegex.find(name)
                ?.groups?.get(1)?.value
                ?: chapterNumberRegex.find(url)?.groups?.get(1)?.value
                ?: "0"

            MangaChapter(
                id = url,
                mangaId = mangaId,
                title = name,
                chapterNumber = chapterNumber,
                language = "en",
                sourceId = MangaSourceId.MANGAPILL,
            )
        }
    }

    fun parsePages(document: Document): List<ChapterPage> {
        return document.select("picture img").mapIndexed { index, element ->
            val imageUrl = element.attr("data-src").takeIf { it.isNotBlank() }
                ?: element.attr("src")
            ChapterPage(
                index = index,
                imageUrl = imageUrl,
                headers = mapOf("Referer" to "$BASE_URL/"),
            )
        }
    }

    private fun parseStatus(text: String?): MangaStatus {
        if (text.isNullOrBlank()) return MangaStatus.UNKNOWN
        return when (text.lowercase().trim()) {
            "publishing" -> MangaStatus.ONGOING
            "finished" -> MangaStatus.COMPLETED
            else -> MangaStatus.UNKNOWN
        }
    }
}
