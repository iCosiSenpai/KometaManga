package snd.komf.sources.mangadex

import snd.komf.providers.mangadex.filesUrl
import snd.komf.providers.mangadex.model.MangaDexArtist
import snd.komf.providers.mangadex.model.MangaDexAuthor
import snd.komf.providers.mangadex.model.MangaDexCoverArt
import snd.komf.providers.mangadex.model.MangaDexManga
import snd.komf.sources.MangaSourceId
import snd.komf.sources.mangadex.model.MangaDexAtHomeResponse
import snd.komf.sources.mangadex.model.MangaDexChapter
import snd.komf.sources.model.ChapterPage
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaDetails
import snd.komf.sources.model.MangaSearchResult
import snd.komf.sources.model.MangaStatus


object MangaDexSourceMapper {

    fun toSearchResult(manga: MangaDexManga): MangaSearchResult {
        val title = manga.attributes.title["en"]
            ?: manga.attributes.title.values.firstOrNull()
            ?: "Unknown"

        val coverFileName = manga.relationships
            .filterIsInstance<MangaDexCoverArt>()
            .firstOrNull()?.attributes?.fileName

        val coverUrl = coverFileName?.let {
            "$filesUrl/covers/${manga.id.value}/$it.256.jpg"
        }

        val altTitles = manga.attributes.altTitles
            .flatMap { it.values }
            .filter { it != title }

        return MangaSearchResult(
            id = manga.id.value,
            title = title,
            alternativeTitles = altTitles,
            coverUrl = coverUrl,
            year = manga.attributes.year,
            status = mapStatus(manga.attributes.status),
            contentRating = manga.attributes.contentRating,
            sourceId = MangaSourceId.MANGADEX,
        )
    }

    fun toMangaDetails(manga: MangaDexManga): MangaDetails {
        val title = manga.attributes.title["en"]
            ?: manga.attributes.title.values.firstOrNull()
            ?: "Unknown"

        val coverFileName = manga.relationships
            .filterIsInstance<MangaDexCoverArt>()
            .firstOrNull()?.attributes?.fileName

        val coverUrl = coverFileName?.let {
            "$filesUrl/covers/${manga.id.value}/$it.512.jpg"
        }

        val altTitles = manga.attributes.altTitles
            .flatMap { it.values }
            .filter { it != title }

        val authors = manga.relationships
            .filterIsInstance<MangaDexAuthor>()
            .map { it.attributes.name }

        val artists = manga.relationships
            .filterIsInstance<MangaDexArtist>()
            .map { it.attributes.name }

        val genres = listOfNotNull(manga.attributes.publicationDemographic?.lowercase()) +
            manga.attributes.tags
                .filter { it.attributes.group == "genre" }
                .mapNotNull { it.attributes.name["en"] ?: it.attributes.name.values.firstOrNull() }

        val tags = manga.attributes.tags
            .filter { it.attributes.group == "theme" }
            .mapNotNull { it.attributes.name["en"] ?: it.attributes.name.values.firstOrNull() }

        val description = manga.attributes.description["en"]
            ?: manga.attributes.description.values.firstOrNull()

        return MangaDetails(
            id = manga.id.value,
            title = title,
            alternativeTitles = altTitles,
            description = description,
            coverUrl = coverUrl,
            authors = authors,
            artists = artists,
            genres = genres,
            tags = tags,
            status = mapStatus(manga.attributes.status),
            year = manga.attributes.year,
            sourceId = MangaSourceId.MANGADEX,
        )
    }

    fun toChapter(chapter: MangaDexChapter, mangaId: String): MangaChapter {
        val scanlator = chapter.relationships
            .firstOrNull { it.type == "scanlation_group" }
            ?.attributes?.name

        return MangaChapter(
            id = chapter.id,
            mangaId = mangaId,
            title = chapter.attributes.title,
            chapterNumber = chapter.attributes.chapter ?: "0",
            volumeNumber = chapter.attributes.volume,
            language = chapter.attributes.translatedLanguage,
            scanlator = scanlator,
            updatedAt = chapter.attributes.updatedAt,
            pageCount = chapter.attributes.pages,
            sourceId = MangaSourceId.MANGADEX,
        )
    }

    fun toChapterPages(atHomeResponse: MangaDexAtHomeResponse): List<ChapterPage> {
        val baseUrl = atHomeResponse.baseUrl
        val hash = atHomeResponse.chapter.hash

        return atHomeResponse.chapter.data.mapIndexed { index, filename ->
            ChapterPage(
                index = index,
                imageUrl = "$baseUrl/data/$hash/$filename",
            )
        }
    }

    private fun mapStatus(status: String): MangaStatus {
        return when (status) {
            "ongoing" -> MangaStatus.ONGOING
            "completed" -> MangaStatus.COMPLETED
            "hiatus" -> MangaStatus.HIATUS
            "cancelled" -> MangaStatus.CANCELLED
            else -> MangaStatus.UNKNOWN
        }
    }
}
