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
        // Search results are in a grid like: div.my-3.grid > div (no class) > a + div
        // Each item has: <a href="/manga/..."><figure><img/></figure></a>
        //                 <div class="flex..."><a href="/manga/..."><div class="font-black">Title</div></a></div>
        return document.select("div.grid a[href^=/manga/]").mapNotNull { link ->
            val url = link.attr("href")
            if (!url.startsWith("/manga/")) return@mapNotNull null

            // Skip duplicate links (each card has 2 links with same href - cover and title)
            // We want the one that contains the title text (the second one with font-black div)
            val titleDiv = link.selectFirst("div.font-black") ?: return@mapNotNull null
            val title = titleDiv.text().takeIf { it.isNotBlank() } ?: return@mapNotNull null

            // Find the cover image from the sibling <a> element (the cover link)
            val parentDiv = link.parent()?.parent() ?: return@mapNotNull null
            val coverUrl = parentDiv.selectFirst("img")?.let { img ->
                img.attr("data-src").takeIf { it.isNotBlank() }
                    ?: img.attr("src").takeIf { it.isNotBlank() }
            }

            MangaSearchResult(
                id = url,
                title = title.trim(),
                coverUrl = coverUrl,
                sourceId = MangaSourceId.MANGAPILL,
            )
        }.distinctBy { it.id }
    }

    fun parseMangaDetails(document: Document, mangaId: String): MangaDetails {
        // The manga detail page structure:
        // div.container > div.flex > [div (cover img), div.flex-col (info)]
        // There are multiple div.container on the page (header, notice, content).
        // We find the right one by looking for the one that contains h1.
        val container = document.select("div.container").firstOrNull { it.selectFirst("h1") != null }

        val title = container?.selectFirst("h1")?.text()
            ?: document.selectFirst("title")?.text()?.substringBefore(" Manga - Mangapill")
            ?: "Unknown"

        // Cover image: div.container > div.flex > div (first child with img) > img
        val coverUrl = container?.selectFirst("div.flex img")?.let { img ->
            img.attr("data-src").takeIf { it.isNotBlank() }
                ?: img.attr("src").takeIf { it.isNotBlank() }
        }

        // Description: inside a <p> tag with class text--secondary or text-sm
        val description = container?.selectFirst("p.text--secondary")?.text()
            ?: container?.selectFirst("div.mb-3 > p")?.text()

        // Genres: links with href containing "genre"
        val genres = document.select("a[href*=genre]").map { it.text() }

        // Status: in a grid with label "Status" followed by a div with the value
        // Structure: div.grid > div > label "Status" + div "publishing"
        val statusText = container?.select("div.grid > div")
            ?.firstOrNull { it.selectFirst("label")?.text()?.equals("Status", ignoreCase = true) == true }
            ?.selectFirst("label ~ div")?.text()
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
        // Chapters are in: <div id="chapters"> <div data-filter-list> <a href="/chapters/...">Chapter N</a>
        return document.select("#chapters a[href^=/chapters/]").mapNotNull { element ->
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
        // Pages are in: <chapter-page><picture><img data-src="..." /></picture></chapter-page>
        return document.select("chapter-page picture img").mapIndexed { index, element ->
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
            "on hiatus" -> MangaStatus.ONGOING
            "discontinued" -> MangaStatus.COMPLETED
            "not yet published" -> MangaStatus.UNKNOWN
            else -> MangaStatus.UNKNOWN
        }
    }
}
