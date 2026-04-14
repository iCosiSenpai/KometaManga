package snd.komf.sources.comick.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ComickSearchResponse(
    val data: List<ComickBrowseComic>,
    @SerialName("next_cursor")
    val cursor: String? = null,
)

@Serializable
data class ComickBrowseComic(
    @SerialName("default_thumbnail")
    val thumbnail: String? = null,
    val slug: String,
    val title: String,
    val hid: String? = null,
    val description: String? = null,
    val status: Int = 0,
    val country: String? = null,
    @SerialName("translation_completed")
    val translationCompleted: Boolean = false,
)

@Serializable
data class ComickChapterList(
    val data: List<ComickChapter>,
    val pagination: ComickPagination? = null,
)

@Serializable
data class ComickChapter(
    val hid: String,
    val chap: String? = null,
    val vol: String? = null,
    val lang: String? = null,
    val title: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null,
    @SerialName("group_name")
    val groups: List<String> = emptyList(),
)

@Serializable
data class ComickPagination(
    @SerialName("current_page")
    val page: Int = 1,
    @SerialName("last_page")
    val lastPage: Int = 1,
)

@Serializable
data class ComickPageListData(
    val chapter: ComickChapterImages,
)

@Serializable
data class ComickChapterImages(
    val images: List<ComickImage>,
)

@Serializable
data class ComickImage(
    val url: String,
)
