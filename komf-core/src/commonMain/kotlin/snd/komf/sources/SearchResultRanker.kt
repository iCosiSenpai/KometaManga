package snd.komf.sources

import kotlin.math.abs
import snd.komf.sources.model.MangaSearchResult

internal fun rankSearchResults(
    query: String,
    results: List<MangaSearchResult>,
): List<MangaSearchResult> {
    val normalizedQuery = query.normalizeSearchText()
    if (normalizedQuery.isBlank()) return results

    val compactQuery = normalizedQuery.replace(" ", "")
    val queryTokens = normalizedQuery.split(" ").filter { it.isNotBlank() }

    return results
        .map { result -> result to searchScore(result.title, normalizedQuery, compactQuery, queryTokens) }
        .filter { (_, score) -> score > 0 }
        .sortedWith(
            compareByDescending<Pair<MangaSearchResult, Int>> { it.second }
                .thenBy { it.first.title.length }
                .thenBy { it.first.title }
        )
        .map { it.first }
}

private fun searchScore(
    title: String,
    normalizedQuery: String,
    compactQuery: String,
    queryTokens: List<String>,
): Int {
    val normalizedTitle = title.normalizeSearchText()
    if (normalizedTitle.isBlank()) return 0

    val compactTitle = normalizedTitle.replace(" ", "")
    val titleTokens = normalizedTitle.split(" ").filter { it.isNotBlank() }

    var score = 0

    if (compactTitle == compactQuery) {
        score += 220
    }
    if (normalizedTitle == normalizedQuery) {
        score += 180
    }
    if (normalizedTitle.startsWith(normalizedQuery)) {
        score += 90
    }
    if (normalizedTitle.contains(normalizedQuery)) {
        score += 50
    }
    if (compactTitle.contains(compactQuery)) {
        score += 40
    }

    val tokenMatches = queryTokens.count { token ->
        titleTokens.contains(token) || normalizedTitle.contains(token)
    }

    score += tokenMatches * 25
    if (queryTokens.isNotEmpty() && tokenMatches == queryTokens.size) {
        score += 40
    }

    score -= abs(compactTitle.length - compactQuery.length).coerceAtMost(30)

    return score
}

private fun String.normalizeSearchText(): String {
    return lowercase()
        .replace(Regex("""[^a-z0-9]+"""), " ")
        .trim()
        .replace(Regex("""\s+"""), " ")
}
