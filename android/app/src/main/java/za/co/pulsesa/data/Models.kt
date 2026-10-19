package za.co.pulsesa.data

import kotlinx.serialization.Serializable

@Serializable
data class Hotspot(
    val slug: String,
    val name: String,
    val lat: Double,
    val lon: Double,
    val weight: Double = 0.0,
    val intensity: Double = 0.0,
)

@Serializable
data class TrendItem(val query: String, val traffic: Long = 0, val url: String? = null)

/** One card in the feed. `type` is "problem", "trending", "video" (YouTube) or "clip" (our own short video). */
@Serializable
data class FeedCard(
    val type: String,
    val id: String,
    val title: String,
    val category: String? = null,
    val categoryLabel: String? = null,
    val color: String? = null,
    val place: String? = null,
    val placeSlug: String? = null,
    val headline: String? = null,
    val publisher: String? = null,
    val url: String? = null,
    val trend: String? = null,
    val ratio: Double? = null,
    val signals: Int? = null,
    val spark: List<Double> = emptyList(),
    val hotspots: List<Hotspot> = emptyList(),
    val updatedAt: String? = null,
    val items: List<TrendItem> = emptyList(),
    val youtubeId: String? = null,
    val creator: String? = null,
    val thumbnail: String? = null,
    val imageUrl: String? = null,
    val clipId: String? = null,
    val storyKey: String? = null,
    val caption: String? = null,
    val hashtags: List<String> = emptyList(),
    val credits: List<String> = emptyList(),
    val videoUrl: String? = null,
    val posterUrl: String? = null,
    val posted: List<String> = emptyList(),
)

/** One of our own short videos, as the server lists it. */
@Serializable
data class Clip(
    val id: String,
    val storyKey: String,
    val day: String = "",
    val title: String,
    val caption: String = "",
    val hashtags: List<String> = emptyList(),
    val credits: List<String> = emptyList(),
    val createdAt: String = "",
    val videoUrl: String,
    val posterUrl: String,
    val posted: List<String> = emptyList(),
) {
    fun asCard() = FeedCard(type = "clip", id = "clip-$id", title = title, clipId = id, storyKey = storyKey, caption = caption,
        hashtags = hashtags, credits = credits, videoUrl = videoUrl, posterUrl = posterUrl, posted = posted, updatedAt = createdAt)
}

@Serializable
data class ClipsResponse(val clips: List<Clip> = emptyList())

/** One line of the post log: a video sent somewhere, or a story skipped because it would be a repeat. */
@Serializable
data class PostLogItem(
    val id: String,
    val clipId: String? = null,
    val storyKey: String,
    val platform: String,
    val status: String,
    val detail: String? = null,
    val createdAt: String,
    val title: String? = null,
)

@Serializable
data class PostLog(val log: List<PostLogItem> = emptyList())

@Serializable
data class FeedResponse(val generatedAt: String, val cards: List<FeedCard>)

@Serializable
data class Layer(val id: String, val label: String, val color: String, val signals: Int = 0)

@Serializable
data class Rising(
    val id: String,
    val slug: String,
    val name: String,
    val headline: String = "",
    val intensity: Double = 0.0,
    val weight: Double = 0.0,
)

@Serializable
data class MapResponse(
    val category: String,
    val label: String,
    val color: String,
    val hotspots: List<Hotspot> = emptyList(),
    val rising: List<Rising> = emptyList(),
    val nationalSignals: Int = 0,
    val layers: List<Layer> = emptyList(),
)

@Serializable
data class SignalItem(
    val title: String,
    val publisher: String? = null,
    val url: String? = null,
    val source: String,
    val publishedAt: String,
)

@Serializable
data class ProblemDetail(
    val id: String,
    val category: String,
    val categoryLabel: String,
    val color: String,
    val place: String? = null,
    val title: String,
    val trend: String,
    val days: List<Double> = emptyList(),
    val sources: Int = 0,
    val signals: List<SignalItem> = emptyList(),
    val hotspots: List<Hotspot> = emptyList(),
)

@Serializable
data class Top3(val date: String, val cards: List<FeedCard> = emptyList(), val caption: String = "")
