package snd.komf.sources.comick

import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ComickSourceClientTest {

    private val json = Json {
        ignoreUnknownKeys = true
    }

    @Test
    fun `parseChapterPagesFromReaderHtml extracts images from sv data`() {
        val html = """
            <html>
              <head></head>
              <body>
                <script id="sv-data" type="application/json">
                  {
                    "chapter": {
                      "hid": "abc123",
                      "chap": "42",
                      "lang": "en",
                      "images": [
                        { "url": "https://cdn2.comicknew.pictures/page-1.webp" },
                        { "url": "https://cdn2.comicknew.pictures/page-2.webp" }
                      ]
                    },
                    "comic": {
                      "slug": "one-piece"
                    }
                  }
                </script>
              </body>
            </html>
        """.trimIndent()

        val result = parseChapterPagesFromReaderHtml(html, json)

        assertEquals(2, result.chapter.images.size)
        assertEquals("https://cdn2.comicknew.pictures/page-1.webp", result.chapter.images[0].url)
        assertEquals("https://cdn2.comicknew.pictures/page-2.webp", result.chapter.images[1].url)
    }

    @Test
    fun `parseChapterPagesFromReaderHtml fails when sv data is missing`() {
        val error = assertFailsWith<IllegalStateException> {
            parseChapterPagesFromReaderHtml("<html><body>No payload</body></html>", json)
        }

        assertEquals("Comick reader page is missing sv-data payload", error.message)
    }
}
