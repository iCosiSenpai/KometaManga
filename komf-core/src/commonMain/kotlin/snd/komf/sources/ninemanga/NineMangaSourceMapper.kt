package snd.komf.sources.ninemanga

import com.fleeksoft.ksoup.nodes.Document
import com.fleeksoft.ksoup.nodes.Element
import snd.komf.sources.MangaSourceId
import snd.komf.sources.model.ChapterPage
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaDetails
import snd.komf.sources.model.MangaSearchResult
import snd.komf.sources.model.MangaStatus

// WeebCentral-backed mapper. Selectors mirror the Tachiyomi WeebCentral extension.
object NineMangaSourceMapper {

    private val chapterNumberRegex = Regex("""chapter\s*(\d+(?:\.\d+)?)""", RegexOption.IGNORE_CASE)
    private val trailingNumberRegex = Regex("""(\d+(?:\.\d+)?)\s*$""")

    fun parseSearchResults(document: Document, sourceId: MangaSourceId): List<MangaSearchResult> {
        // Each search result is an <a> inside <article><section>. The last unclassed div in the link
        // contains the title text; the cover is a <source srcset="..."> inside <picture>.
        val anchors = document.select("article > section > a")
            .ifEmpty { document.select("section a[href*=/series/]") }

        return anchors.mapNotNull { link ->
            val href = link.attr("abs:href").ifBlank { link.attr("href") }
                .takeIf { it.isNotBlank() } ?: return@mapNotNull null
            if (!href.contains("/series/")) return@mapNotNull null

            val title = link.selectFirst("div:not([class]):last-child")?.text()?.trim()
                ?: link.selectFirst("div.truncate")?.text()?.trim()
                ?: link.selectFirst("div")?.text()?.trim()
                ?: link.attr("title").takeIf { it.isNotBlank() }
                ?: return@mapNotNull null

            val coverUrl = extractCoverUrl(link)

            MangaSearchResult(
                id = href,
                title = title,
                coverUrl = coverUrl,
                sourceId = sourceId,
            )
        }.distinctBy { it.id }
    }

    fun parseMangaDetails(document: Document, mangaId: String, sourceId: MangaSourceId): MangaDetails {
        val title = document.selectFirst("section h1, main h1, h1")?.text()?.trim()
            ?: document.selectFirst("title")?.text()?.substringBefore(" | ")?.trim()
            ?: "Unknown"

        val coverUrl = extractCoverUrl(document)

        val author = document.select("ul > li:has(strong:contains(Author)) > span > a, ul > li:has(strong:contains(Author)) a")
            .joinToString(", ") { it.text().trim() }
            .takeIf { it.isNotBlank() }

        val genres = document.select(
            "ul > li:has(strong:contains(Tag)) a, ul > li:has(strong:contains(Tags)) a, ul > li:has(strong:contains(Type)) a"
        ).map { it.text().trim() }.filter { it.isNotBlank() }

        val statusText = document.selectFirst("ul > li:has(strong:contains(Status)) > a, ul > li:has(strong:contains(Status)) a, ul > li:has(strong:contains(Status)) span")
            ?.text()?.trim()

        val description = document.selectFirst("li:has(strong:contains(Description)) > p, li:has(strong:contains(Description)) p, p.whitespace-pre-wrap")
            ?.text()?.trim()

        val year = document.selectFirst("ul > li:has(strong:contains(Released)) > span, ul > li:has(strong:contains(Released)) a")
            ?.text()?.trim()?.take(4)?.toIntOrNull()

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
        // Full chapter list markup: a list of <a> inside <div x-data="...">.
        val anchors = document.select("div[x-data] > a[href*=/chapters/]")
            .ifEmpty { document.select("a[href*=/chapters/]") }

        return anchors.mapNotNull { link ->
            val href = link.attr("abs:href").ifBlank { link.attr("href") }
                .takeIf { it.isNotBlank() } ?: return@mapNotNull null

            val rawName = (link.selectFirst("span.flex > span")?.text()
                ?: link.selectFirst("span")?.text()
                ?: link.text())
                .trim()
                .takeIf { it.isNotBlank() } ?: return@mapNotNull null

            val chapterNumber = chapterNumberRegex.find(rawName)?.groups?.get(1)?.value
                ?: trailingNumberRegex.find(rawName)?.groups?.get(1)?.value
                ?: "0"

            val title = if (rawName.contains("chapter", ignoreCase = true)) rawName else "Chapter $rawName"

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
        val images = document.select("section[x-data~=scroll] > img")
            .ifEmpty { document.select("section img[src*=/manga/], img[alt^=Page]") }

        return images.mapIndexedNotNull { index, element ->
            val imageUrl = element.attr("abs:src").ifBlank { element.attr("src") }
            if (imageUrl.isBlank()) null
            else ChapterPage(
                index = index,
                imageUrl = imageUrl,
                headers = mapOf("Referer" to referer),
            )
        }
    }

    private fun extractCoverUrl(root: Element): String? {
        val source = root.selectFirst("picture source[srcset], source[srcset]")
        val fromSrcset = source?.attr("srcset")?.substringBefore(' ')?.takeIf { it.isNotBlank() }
        if (fromSrcset != null) return resolveUrl(root, fromSrcset)

        val img = root.selectFirst("picture img, img")
        val fromImg = img?.let {
            it.attr("abs:src").ifBlank { it.attr("src") }
                .ifBlank { it.attr("data-src") }
        }
        return fromImg?.takeIf { it.isNotBlank() }?.let { resolveUrl(root, it) }
    }

    private fun resolveUrl(root: Element, url: String): String {
        if (url.startsWith("http")) return url
        val base = root.baseUri().takeIf { it.isNotBlank() } ?: return url
        return if (url.startsWith("/")) {
            val schemeEnd = base.indexOf("//")
            val host = if (schemeEnd >= 0) base.substring(0, base.indexOf('/', schemeEnd + 2).let { if (it < 0) base.length else it }) else base
            "$host$url"
        } else url
    }

    private fun parseStatus(text: String?): MangaStatus {
        if (text.isNullOrBlank()) return MangaStatus.UNKNOWN
        return when (text.lowercase().trim()) {
            "ongoing" -> MangaStatus.ONGOING
            "complete", "completed" -> MangaStatus.COMPLETED
            "hiatus" -> MangaStatus.HIATUS
            "cancelled", "canceled", "dropped" -> MangaStatus.CANCELLED
            else -> MangaStatus.UNKNOWN
        }
    }
}
