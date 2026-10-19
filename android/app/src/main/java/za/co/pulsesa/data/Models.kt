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

/** One card in the feed. `type` is "problem", "trending" or "video"; other fields depend on it. */
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
)

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
