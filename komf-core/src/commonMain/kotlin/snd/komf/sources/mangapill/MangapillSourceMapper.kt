package snd.komf.sources.mangapill

import com.fleeksoft.ksoup.nodes.Document
import com.fleeksoft.ksoup.nodes.Element
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
        // Search result grid: ".grid > div:not([class])". Each card has:
        //   <div>
        //     <a href="/manga/...."><figure><img data-src="..." src="..." /></figure></a>
        //     <div><a href="/manga/....">Title text</a> ... </div>
        //   </div>
        return document.select(".grid > div:not([class])").mapNotNull { card ->
            val links = card.select("a[href^=/manga/]")
            if (links.isEmpty()) return@mapNotNull null

            val mangaUrl = links.first()!!.attr("href").takeIf { it.isNotBlank() }
                ?: return@mapNotNull null

            // Prefer the link that carries the actual title text (not the cover link).
            val titleLink = links.firstOrNull { it.text().isNotBlank() }
            val title = titleLink?.text()?.trim()
                ?: card.selectFirst("div.leading-tight")?.text()?.trim()
                ?: card.selectFirst("div.font-black")?.text()?.trim()
                ?: return@mapNotNull null

            val coverUrl = card.selectFirst("img")?.let(::extractImageUrl)

            MangaSearchResult(
                id = mangaUrl,
                title = title,
                coverUrl = coverUrl,
                sourceId = MangaSourceId.MANGAPILL,
            )
        }.distinctBy { it.id }
    }

    fun parseMangaDetails(document: Document, mangaId: String): MangaDetails {
        // Authoritative selectors taken from the Tachiyomi MangaPill extension.
        val root = document.selectFirst("div.container > div:first-child")

        val title = root?.selectFirst("h1")?.text()?.trim()
            ?: document.selectFirst("h1")?.text()?.trim()
            ?: document.selectFirst("title")?.text()?.substringBefore(" Manga - Mangapill")?.trim()
            ?: "Unknown"

        val coverUrl = (root?.selectFirst("div:first-child > img")
            ?: document.selectFirst("div.container img"))
            ?.let(::extractImageUrl)

        val description = root?.selectFirst("div:last-child > div:nth-child(2) > p")?.text()?.trim()
            ?: document.select("div.container p").firstOrNull { it.text().length > 40 }?.text()?.trim()

        val statusText = root?.selectFirst("div:last-child > div:nth-child(3) > div:nth-child(2) > div")?.text()
            ?: document.select("label").firstOrNull { it.text().equals("Status", ignoreCase = true) }
                ?.parent()?.selectFirst("div")?.text()

        val genres = document.select("a[href*=genre]").map { it.text().trim() }.filter { it.isNotBlank() }

        return MangaDetails(
            id = mangaId,
            title = title,
            description = description,
            coverUrl = coverUrl,
            genres = genres,
            status = parseStatus(statusText),
            sourceId = MangaSourceId.MANGAPILL,
        )
    }

    fun parseChapters(document: Document, mangaId: String): List<MangaChapter> {
        return document.select("#chapters > div > a, #chapters a[href^=/chapters/]").mapNotNull { element ->
            val url = element.attr("href").takeIf { it.isNotBlank() } ?: return@mapNotNull null
            val name = element.text().trim().ifBlank { url.substringAfterLast('/').replace('-', ' ') }

            val chapterNumber = chapterNumberRegex.find(name)?.groups?.get(1)?.value
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
        }.distinctBy { it.id }
    }

    fun parsePages(document: Document): List<ChapterPage> {
        // Page images live inside <picture><img data-src="..."/></picture>.
        // The wrapping <chapter-page> custom element isn't always present in server HTML.
        return document.select("picture img, chapter-page img").mapIndexedNotNull { index, element ->
            val imageUrl = extractImageUrl(element) ?: return@mapIndexedNotNull null
            ChapterPage(
                index = index,
                imageUrl = imageUrl,
                headers = mapOf("Referer" to "$BASE_URL/"),
            )
        }
    }

    private fun extractImageUrl(img: Element): String? {
        val candidates = listOf(
            img.attr("data-src"),
            img.attr("data-srcset").substringBefore(' '),
            img.attr("src"),
            img.attr("srcset").substringBefore(' '),
        )
        return candidates.firstOrNull { it.isNotBlank() }
    }

    private fun parseStatus(text: String?): MangaStatus {
        if (text.isNullOrBlank()) return MangaStatus.UNKNOWN
        return when (text.lowercase().trim()) {
            "publishing" -> MangaStatus.ONGOING
            "finished" -> MangaStatus.COMPLETED
            "on hiatus", "hiatus" -> MangaStatus.HIATUS
            "discontinued", "cancelled", "canceled" -> MangaStatus.CANCELLED
            "not yet published" -> MangaStatus.UNKNOWN
            else -> MangaStatus.UNKNOWN
        }
    }
}
