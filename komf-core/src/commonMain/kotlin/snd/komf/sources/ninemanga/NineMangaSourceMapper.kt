package snd.komf.sources.ninemanga

import com.fleeksoft.ksoup.nodes.Document
import snd.komf.sources.MangaSourceId
import snd.komf.sources.model.ChapterPage
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaDetails
import snd.komf.sources.model.MangaSearchResult
import snd.komf.sources.model.MangaStatus

object NineMangaSourceMapper {

    private val chapterNumberRegex = Regex("""Chapter\s+(\d+(?:\.\d+)?)""", RegexOption.IGNORE_CASE)

    fun parseSearchResults(document: Document, sourceId: MangaSourceId): List<MangaSearchResult> {
        return document.select("section#quick-search-result a[href*=/series/]").mapNotNull { element ->
            val href = element.attr("abs:href").takeIf { it.isNotBlank() }
                ?: return@mapNotNull null
            val title = element.selectFirst("div.flex-1")?.text()?.trim()
                ?.takeIf { it.isNotBlank() }
                ?: return@mapNotNull null
            val coverUrl = element.selectFirst("img")?.attr("abs:src")
                ?: element.selectFirst("img")?.attr("src")

            MangaSearchResult(
                id = href,
                title = title,
                coverUrl = coverUrl,
                sourceId = sourceId,
            )
        }
    }

    fun parseMangaDetails(document: Document, mangaId: String, sourceId: MangaSourceId): MangaDetails {
        val title = document.selectFirst("main h1")?.text()?.trim()
            ?: document.selectFirst("title")?.text()?.substringBefore(" | ")
            ?: "Unknown"

        val detailsList = document.select("section ul li")
        val author = detailsList.firstOrNull { it.text().contains("Author(s):") }
            ?.select("a")?.joinToString(", ") { it.text().trim() }
            ?.takeIf { it.isNotBlank() }
        val genres = detailsList.firstOrNull { it.text().contains("Tags(s):") }
            ?.select("a")
            ?.map { it.text().trim() }
            ?.filter { it.isNotBlank() }
            ?: emptyList()
        val statusText = detailsList.firstOrNull { it.text().contains("Status:") }
            ?.selectFirst("a, span")
            ?.text()
        val year = detailsList.firstOrNull { it.text().contains("Released:") }
            ?.selectFirst("span")
            ?.text()
            ?.toIntOrNull()

        val coverUrl = document.selectFirst("section picture img")?.attr("abs:src")
            ?: document.selectFirst("section picture img")?.attr("src")
        val description = document.selectFirst("strong:contains(Description) + p, li strong:contains(Description) + p")?.text()
            ?: document.select("li").firstOrNull { it.text().contains("Description") }?.selectFirst("p")?.text()

        return MangaDetails(
            id = mangaId,
            title = title,
            description = description,
            coverUrl = coverUrl,
            authors = listOfNotNull(author),
            artists = emptyList(),
            genres = genres,
            status = parseStatus(statusText),
            year = year,
            sourceId = sourceId,
        )
    }

    fun parseChapters(document: Document, mangaId: String, language: String, sourceId: MangaSourceId): List<MangaChapter> {
        return document.select("a[href*=/chapters/]").mapNotNull { link ->
            val href = link.attr("abs:href").takeIf { it.isNotBlank() }
                ?: return@mapNotNull null
            val rawText = link.text().trim().takeIf { it.isNotBlank() }
                ?: return@mapNotNull null

            val chapterNumber = chapterNumberRegex.find(rawText)?.groups?.get(1)?.value ?: "0"
            val title = if (chapterNumber == "0") rawText else "Chapter $chapterNumber"

            MangaChapter(
                id = href,
                mangaId = mangaId,
                title = title,
                chapterNumber = chapterNumber,
                language = language,
                sourceId = sourceId,
            )
        }.distinctBy { it.id }
    }

    fun parsePages(document: Document, referer: String): List<ChapterPage> {
        return document.select("img[alt^=Page]").mapIndexedNotNull { index, element ->
            val imageUrl = element.attr("abs:src").ifBlank { element.attr("src") }
            if (imageUrl.isBlank()) {
                null
            } else {
                ChapterPage(
                    index = index,
                    imageUrl = imageUrl,
                    headers = mapOf("Referer" to referer),
                )
            }
        }
    }

    private fun parseStatus(text: String?): MangaStatus {
        if (text.isNullOrBlank()) return MangaStatus.UNKNOWN
        return when (text.lowercase().trim()) {
            "ongoing" -> MangaStatus.ONGOING
            "complete", "completed" -> MangaStatus.COMPLETED
            "hiatus" -> MangaStatus.HIATUS
            "cancelled", "dropped" -> MangaStatus.CANCELLED
            else -> MangaStatus.UNKNOWN
        }
    }
}
