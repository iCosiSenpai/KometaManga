package snd.komf.sources.mangafire

import com.fleeksoft.ksoup.nodes.Document
import snd.komf.sources.MangaSourceId
import snd.komf.sources.model.ChapterPage
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaDetails
import snd.komf.sources.model.MangaSearchResult
import snd.komf.sources.model.MangaStatus

private const val BASE_URL = "https://mangafire.to"

object MangafireSourceMapper {

    private val chapterNumberRegex = Regex("""chapter[- ](\d+(?:\.\d+)?)""", RegexOption.IGNORE_CASE)
    private val chapterLangRegex = Regex("""/read/[^/]+/([a-z]{2})/chapter-""")

    fun parseSearchResults(document: Document): List<MangaSearchResult> {
        return document.select("a.unit").mapNotNull { element ->
            val href = element.attr("href")
            val url = if (href.startsWith("/")) href else "/$href"
            val title = element.selectFirst(".info h6")?.text()
                ?: element.selectFirst("h6")?.text()
                ?: return@mapNotNull null
            val coverUrl = element.selectFirst(".poster img")?.let { img ->
                img.attr("src").takeIf { it.isNotBlank() }
            }
            val statusText = element.selectFirst(".info div span:first-child")?.text()
            val status = parseStatus(statusText)

            MangaSearchResult(
                id = url,
                title = title.trim(),
                coverUrl = coverUrl,
                status = status,
                sourceId = MangaSourceId.MANGAFIRE,
            )
        }
    }

    fun parseMangaDetails(document: Document, mangaId: String): MangaDetails {
        val title = document.selectFirst("h1")?.text()
            ?: document.selectFirst("title")?.text()?.substringBefore(" - MangaFire")
            ?: "Unknown"

        val altTitlesText = document.selectFirst("h6")?.text() ?: ""
        val alternativeTitles = if (altTitlesText.isNotBlank()) {
            altTitlesText.split(";").map { it.trim() }.filter { it.isNotBlank() && it != title }
        } else emptyList()

        val coverUrl = document.select("img[src*=\"static.mfcdn.nl\"]").firstOrNull()?.attr("src")
            ?: document.selectFirst(".poster img")?.attr("src")

        val description = document.select("p").firstOrNull { element ->
            val text = element.text()
            text.length > 50 && !text.contains("MangaFire does not store")
        }?.text()

        val authors = document.select("a[href*=\"/author/\"]").map { it.text().trim() }
            .filter { it.isNotBlank() }

        val genres = document.select("a[href*=\"/genre/\"]").map { it.text().trim() }
            .filter { it.isNotBlank() }

        val statusText = document.select("span, div").firstOrNull { element ->
            val text = element.text().uppercase()
            text == "COMPLETED" || text == "ONGOING" || text == "RELEASING" ||
                text == "ON HIATUS" || text == "DISCONTINUED"
        }?.text()
        val status = parseStatus(statusText)

        return MangaDetails(
            id = mangaId,
            title = title,
            alternativeTitles = alternativeTitles,
            description = description,
            coverUrl = coverUrl,
            authors = authors,
            genres = genres,
            status = status,
            sourceId = MangaSourceId.MANGAFIRE,
        )
    }

    fun parseChapters(document: Document, mangaId: String, language: String?): List<MangaChapter> {
        return document.select("a[href*=\"/read/\"]").mapNotNull { element ->
            val href = element.attr("href")
            if (!href.contains("/chapter-")) return@mapNotNull null

            val url = if (href.startsWith("/")) href else "/$href"
            val name = element.text().trim()

            val chapterLang = chapterLangRegex.find(url)?.groups?.get(1)?.value ?: "en"
            if (language != null && chapterLang != language) return@mapNotNull null

            val chapterNumber = chapterNumberRegex.find(url)?.groups?.get(1)?.value
                ?: chapterNumberRegex.find(name)?.groups?.get(1)?.value
                ?: "0"

            val titlePart = name
                .replace(Regex("""^Chapter\s+\d+(?:\.\d+)?:?\s*""", RegexOption.IGNORE_CASE), "")
                .replace(Regex("""\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}$"""), "")
                .trim()
                .takeIf { it.isNotBlank() }

            MangaChapter(
                id = url,
                mangaId = mangaId,
                title = titlePart,
                chapterNumber = chapterNumber,
                language = chapterLang,
                sourceId = MangaSourceId.MANGAFIRE,
            )
        }
    }

    fun parsePages(document: Document): List<ChapterPage> {
        return document.select("img[src*=\"mfcdn\"]").mapIndexed { index, element ->
            val imageUrl = element.attr("src")
            ChapterPage(
                index = index,
                imageUrl = imageUrl,
                headers = mapOf("Referer" to "$BASE_URL/"),
            )
        }
    }

    private fun parseStatus(text: String?): MangaStatus {
        if (text.isNullOrBlank()) return MangaStatus.UNKNOWN
        return when (text.uppercase().trim()) {
            "COMPLETED" -> MangaStatus.COMPLETED
            "ONGOING", "RELEASING" -> MangaStatus.ONGOING
            "ON HIATUS" -> MangaStatus.ONGOING
            "DISCONTINUED", "CANCELLED" -> MangaStatus.COMPLETED
            else -> MangaStatus.UNKNOWN
        }
    }
}
