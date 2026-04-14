package snd.komf.sources

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpRequestRetry
import io.ktor.client.plugins.UserAgent
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.header
import io.ktor.http.HttpStatusCode.Companion.TooManyRequests
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import kotlinx.serialization.modules.SerializersModule
import kotlinx.serialization.modules.polymorphic
import kotlinx.serialization.modules.subclass
import snd.komf.ktor.HttpRequestRateLimiter
import snd.komf.providers.mangadex.model.MangaDexArtist
import snd.komf.providers.mangadex.model.MangaDexAuthor
import snd.komf.providers.mangadex.model.MangaDexCoverArt
import snd.komf.providers.mangadex.model.MangaDexRelationship
import snd.komf.providers.mangadex.model.MangaDexUnknownRelationship
import snd.komf.sources.comick.ComickSource
import snd.komf.sources.comick.ComickSourceClient
import snd.komf.sources.mangadex.MangaDexSource
import snd.komf.sources.mangadex.MangaDexSourceClient
import snd.komf.sources.mangafire.MangafireSource
import snd.komf.sources.mangafire.MangafireSourceClient
import snd.komf.sources.mangapill.MangapillSource
import snd.komf.sources.mangapill.MangapillSourceClient
import snd.komf.sources.mangaworld.MangaWorldSource
import snd.komf.sources.mangaworld.MangaWorldSourceClient
import snd.komf.sources.ninemanga.NineMangaSource
import snd.komf.sources.ninemanga.NineMangaSourceClient
import kotlin.time.Duration.Companion.seconds

private val logger = KotlinLogging.logger { }

class MangaSourcesModule(
    baseHttpClient: HttpClient,
) {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = false
        serializersModule = SerializersModule {
            polymorphic(MangaDexRelationship::class) {
                subclass(MangaDexAuthor::class)
                subclass(MangaDexArtist::class)
                subclass(MangaDexCoverArt::class)
                defaultDeserializer { MangaDexUnknownRelationship.serializer() }
            }
        }
    }

    private val baseHttpClientJson = baseHttpClient.config {
        install(ContentNegotiation) { json(json) }
    }

    private val mangaDexSourceClient = MangaDexSourceClient(
        baseHttpClientJson.config {
            install(HttpRequestRateLimiter) {
                interval = 10.seconds
                eventsPerInterval = 15
                allowBurst = true
            }
            install(HttpRequestRetry) {
                retryIf(3) { _, response ->
                    when (response.status.value) {
                        TooManyRequests.value -> true
                        in 500..599 -> true
                        else -> false
                    }
                }
                exponentialDelay(baseDelayMs = 2000, respectRetryAfterHeader = true)
            }
        }
    )

    private val mangaDexSource = MangaDexSource(mangaDexSourceClient)

    private val comickSourceClient = ComickSourceClient(
        ktor = baseHttpClientJson.config {
            install(UserAgent) {
                agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
            }
            defaultRequest {
                headers.append("Referer", "https://comick.art/")
            }
            install(HttpRequestRateLimiter) {
                interval = 10.seconds
                // Large Comick series may span 40+ chapter-list pages.
                // Keep enough burst capacity to fetch them without timing out.
                eventsPerInterval = 20
                allowBurst = true
            }
            install(HttpRequestRetry) {
                retryIf(3) { _, response ->
                    when (response.status.value) {
                        TooManyRequests.value -> true
                        in 500..599 -> true
                        else -> false
                    }
                }
                exponentialDelay(baseDelayMs = 2000, respectRetryAfterHeader = true)
            }
        },
        json = json,
    )

    private val comickSource = ComickSource(comickSourceClient)

    private val scraperHttpClient = baseHttpClientJson.config {
        install(HttpRequestRateLimiter) {
            interval = 10.seconds
            eventsPerInterval = 5
            allowBurst = false
        }
        install(HttpRequestRetry) {
            retryIf(3) { _, response ->
                when (response.status.value) {
                    TooManyRequests.value -> true
                    in 500..599 -> true
                    else -> false
                }
            }
            exponentialDelay(baseDelayMs = 2000, respectRetryAfterHeader = true)
        }
    }

    private val mangaWorldSource = MangaWorldSource(
        client = MangaWorldSourceClient(scraperHttpClient)
    )

    private val mangapillSource = MangapillSource(
        client = MangapillSourceClient(scraperHttpClient)
    )

    private val mangafireSource = MangafireSource(
        client = MangafireSourceClient(scraperHttpClient)
    )

    private val nineMangaEnClient = NineMangaSourceClient(
        ktor = scraperHttpClient,
        baseUrl = "https://weebcentral.com",
    )

    private val nineMangaSource = NineMangaSource(
        client = nineMangaEnClient,
        id = MangaSourceId.NINEMANGA,
        name = "WeebCentral",
        language = "en",
        baseUrl = "https://weebcentral.com",
    )

    private val allSources: Map<MangaSourceId, MangaSource> = mapOf(
        MangaSourceId.MANGADEX to mangaDexSource,
        MangaSourceId.COMICK to comickSource,
        MangaSourceId.MANGAWORLD to mangaWorldSource,
        MangaSourceId.MANGAPILL to mangapillSource,
        MangaSourceId.MANGAFIRE to mangafireSource,
        MangaSourceId.NINEMANGA to nineMangaSource,
    )

    fun getSource(sourceId: MangaSourceId): MangaSource {
        return allSources[sourceId]
            ?: throw IllegalArgumentException("Source $sourceId not found")
    }

    fun getAllSources(): Map<MangaSourceId, MangaSource> = allSources

    fun getEnabledSources(): List<MangaSource> {
        // For now all registered sources are enabled
        // TODO: filter by config when download config is implemented
        return allSources.values.toList()
    }
}
