package snd.komf.sources.comick

import snd.komf.sources.MangaSourceId
import snd.komf.sources.comick.model.ComickBrowseComic
import snd.komf.sources.comick.model.ComickChapter
import snd.komf.sources.model.MangaChapter
import snd.komf.sources.model.MangaDetails
import snd.komf.sources.model.MangaSearchResult
import snd.komf.sources.model.MangaStatus

private const val BASE_URL = "https://comick.art"

object ComickSourceMapper {

    fun toSearchResult(comic: ComickBrowseComic): MangaSearchResult {
        return MangaSearchResult(
            id = comic.slug,
            title = comic.title,
            coverUrl = comic.thumbnail,
            sourceId = MangaSourceId.COMICK,
        )
    }

    fun toMangaDetails(data: ComickBrowseComic): MangaDetails {
        return MangaDetails(
            id = data.slug,
            title = data.title,
            description = data.description,
            coverUrl = data.thumbnail,
            authors = emptyList(),
            artists = emptyList(),
            genres = emptyList(),
            status = mapStatus(data.status, data.translationCompleted),
            sourceId = MangaSourceId.COMICK,
        )
    }

    fun toChapter(chapter: ComickChapter, mangaSlug: String): MangaChapter {
        val chapterNumber = chapter.chap?.trim().takeUnless { it.isNullOrBlank() } ?: "0"
        val language = chapter.lang?.trim()?.lowercase().takeUnless { it.isNullOrBlank() } ?: "en"

        return MangaChapter(
            id = "$BASE_URL/comic/$mangaSlug/${chapter.hid}-chapter-$chapterNumber-$language",
            mangaId = mangaSlug,
            title = chapter.title,
            chapterNumber = chapterNumber,
            volumeNumber = chapter.vol,
            language = chapter.lang,
            scanlator = chapter.groups.joinToString().takeIf { it.isNotBlank() },
            sourceId = MangaSourceId.COMICK,
        )
    }

    private fun mapStatus(status: Int, translationCompleted: Boolean): MangaStatus {
        return when (status) {
            1 -> MangaStatus.ONGOING
            2 -> if (translationCompleted) MangaStatus.COMPLETED else MangaStatus.COMPLETED
            3 -> MangaStatus.CANCELLED
            4 -> MangaStatus.HIATUS
            else -> MangaStatus.UNKNOWN
        }
    }
}
