package za.co.pulsesa.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.Duration
import java.time.Instant

@Composable
fun Chip(text: String, color: Color, filled: Boolean = true) {
    val shape = RoundedCornerShape(50)
    Text(
        text, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
        color = if (filled) Pulse.Ground else Pulse.Soft,
        modifier = (if (filled) Modifier.background(color, shape) else Modifier.border(1.dp, Pulse.Border, shape))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

@Composable
fun Brand() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(24.dp).border(2.dp, Pulse.Teal, CircleShape), contentAlignment = Alignment.Center) {
            Box(Modifier.size(8.dp).background(Pulse.Amber, CircleShape))
        }
        Spacer(Modifier.size(8.dp))
        Text("Pulse", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Pulse.Text)
        Text(" SA", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Pulse.Teal)
    }
}

/** A small trend line from oldest to newest value. */
@Composable
fun Sparkline(values: List<Double>, color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        if (values.size < 2) return@Canvas
        val max = (values.maxOrNull() ?: 0.0).coerceAtLeast(1.0)
        val step = size.width / (values.size - 1)
        val path = Path()
        values.forEachIndexed { i, v ->
            val o = Offset(i * step, size.height - (v / max).toFloat() * (size.height - 4f) - 2f)
            if (i == 0) path.moveTo(o.x, o.y) else path.lineTo(o.x, o.y)
        }
        drawPath(path, color, style = Stroke(width = 5f, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

@Composable
fun Loading() = Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Pulse.Teal) }

@Composable
fun Problem(message: String, onRetry: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(32.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text("Couldn't load", fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Spacer(Modifier.height(6.dp))
        Text(message, color = Pulse.Muted, textAlign = TextAlign.Center)
        Spacer(Modifier.height(16.dp))
        Button(onClick = onRetry, colors = ButtonDefaults.buttonColors(containerColor = Pulse.Teal, contentColor = Pulse.Ground)) { Text("Try again") }
    }
}

fun ago(iso: String?): String {
    if (iso == null) return ""
    return try {
        val m = Duration.between(Instant.parse(iso), Instant.now()).toMinutes()
        when {
            m < 1 -> "just now"
            m < 60 -> "$m min ago"
            m < 60 * 24 -> "${m / 60} h ago"
            else -> "${m / (60 * 24)} d ago"
        }
    } catch (_: Exception) { "" }
}

fun traffic(n: Long): String = when {
    n >= 1_000_000 -> "${n / 1_000_000}M+ searches"
    n >= 1_000 -> "${n / 1_000}K+ searches"
    n > 0 -> "$n+ searches"
    else -> ""
}
