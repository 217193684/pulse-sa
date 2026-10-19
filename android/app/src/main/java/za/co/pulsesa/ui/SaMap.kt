package za.co.pulsesa.ui

import android.content.Context
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.sp
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import za.co.pulsesa.data.Hotspot
import kotlin.math.cos
import kotlin.math.min

/** Real borders (Natural Earth 1:50m) shipped with the app in assets/sa-outline.json. */
@Serializable
private data class Outline(val southAfrica: List<List<Double>>, val lesotho: List<List<Double>>, val eswatini: List<List<Double>>)

private object Geo {
    @Volatile private var cached: Outline? = null
    fun outline(ctx: Context): Outline = cached ?: synchronized(this) {
        cached ?: Json { ignoreUnknownKeys = true }
            .decodeFromString<Outline>(ctx.assets.open("sa-outline.json").bufferedReader().use { it.readText() })
            .also { cached = it }
    }
}

private val CITIES = listOf(
    Triple("Johannesburg", 28.047, -26.204), Triple("Durban", 31.022, -29.858), Triple("Cape Town", 18.424, -33.925),
    Triple("Gqeberha", 25.615, -33.961), Triple("Bloemfontein", 26.159, -29.085), Triple("Polokwane", 29.469, -23.904),
    Triple("East London", 27.912, -33.015), Triple("Kimberley", 24.763, -28.738), Triple("Mbombela", 30.97, -25.475),
)

private const val LON0 = 16.2
private const val LON1 = 33.1
private const val LAT0 = -21.9
private const val LAT1 = -35.0
private val KX = cos(Math.toRadians(28.5)).toFloat()

/**
 * South Africa with glowing heat where a problem is concentrated.
 * [interactive] = pinch to zoom and drag to pan (the map tab); off in feed cards so swiping still works.
 */
@Composable
fun SaMap(hotspots: List<Hotspot>, color: Color, modifier: Modifier = Modifier, interactive: Boolean = false, showLabels: Boolean = true) {
    val ctx = LocalContext.current
    val outline = remember { Geo.outline(ctx) }
    val measurer = rememberTextMeasurer()
    var scale by remember { mutableFloatStateOf(1f) }
    var pan by remember { mutableStateOf(Offset.Zero) }
    val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1800, easing = LinearEasing), RepeatMode.Restart), label = "p",
    )
    val gestures = if (interactive) Modifier.pointerInput(Unit) {
        detectTransformGestures { _, p, zoom, _ ->
            scale = (scale * zoom).coerceIn(1f, 6f)
            pan = if (scale == 1f) Offset.Zero else pan + p
        }
    } else Modifier

    Canvas(modifier.then(gestures)) {
        val s = min(size.width / ((LON1 - LON0).toFloat() * KX), size.height / (LAT0 - LAT1).toFloat())
        val ox = (size.width - (LON1 - LON0).toFloat() * KX * s) / 2f
        val oy = (size.height - (LAT0 - LAT1).toFloat() * s) / 2f
        fun p(lon: Double, lat: Double) = Offset(ox + ((lon - LON0) * KX * s).toFloat(), oy + ((LAT0 - lat) * s).toFloat())
        fun ring(pts: List<List<Double>>) = Path().apply {
            pts.forEachIndexed { i, (lon, lat) -> val o = p(lon, lat); if (i == 0) moveTo(o.x, o.y) else lineTo(o.x, o.y) }
            close()
        }
        val sa = ring(outline.southAfrica)

        withTransform({
            translate(pan.x, pan.y)
            scale(scale, scale, pivot = center)
        }) {
            // Light GIS grid every 2 degrees
            for (lon in 16..34 step 2) drawLine(Pulse.Grid, p(lon.toDouble(), -21.5), p(lon.toDouble(), -35.2), strokeWidth = 1f / scale)
            for (lat in 22..35 step 2) drawLine(Pulse.Grid, p(15.8, -lat.toDouble()), p(33.4, -lat.toDouble()), strokeWidth = 1f / scale)

            drawPath(sa, Pulse.Land)
            clipPath(sa) {
                hotspots.take(14).forEach { h ->
                    val c = p(h.lon, h.lat)
                    val r = (0.06f + 0.16f * h.intensity.toFloat()) * size.minDimension
                    drawCircle(
                        Brush.radialGradient(listOf(color.copy(alpha = 0.95f), color.copy(alpha = 0.4f), Color.Transparent), center = c, radius = r),
                        radius = r, center = c, alpha = (0.45f + 0.55f * h.intensity.toFloat()).coerceIn(0f, 1f),
                    )
                }
            }
            drawPath(sa, Pulse.Border, style = Stroke(width = 1.6f / scale))
            for (hole in listOf(outline.lesotho, outline.eswatini)) {
                val path = ring(hole)
                drawPath(path, Pulse.Ground)
                drawPath(path, Pulse.Border, style = Stroke(width = 1f / scale))
            }
            if (showLabels) {
                val style = TextStyle(color = Pulse.Muted, fontSize = (10f / scale).coerceAtLeast(5f).sp)
                CITIES.forEach { (name, lon, lat) ->
                    val o = p(lon, lat)
                    drawCircle(Pulse.Muted, radius = 2.2f / scale, center = o)
                    drawText(measurer, name, topLeft = o + Offset(4f / scale, -6f / scale), style = style)
                }
            }
            hotspots.firstOrNull()?.let { h ->
                val c = p(h.lon, h.lat)
                drawCircle(color.copy(alpha = 1f - pulse), radius = (6f + 22f * pulse) / scale, center = c, style = Stroke(width = 2.5f / scale))
                drawCircle(color, radius = 5f / scale, center = c)
            }
        }
    }
}
