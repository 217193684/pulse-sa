package za.co.pulsesa.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object Pulse {
    val Ground = Color(0xFF0B0F14)
    val Surface = Color(0xFF111821)
    val Raised = Color(0xFF1B2530)
    val Line = Color(0xFF22303C)
    val Text = Color(0xFFEAF2F7)
    val Soft = Color(0xFFB7C6D2)
    val Muted = Color(0xFF8FA3B3)
    val Teal = Color(0xFF2DD4BF)
    val Amber = Color(0xFFF59E0B)
    val Land = Color(0xFF132029)
    val Border = Color(0xFF35506A)
    val Grid = Color(0xFF16212B)
}

fun hexColor(hex: String?, fallback: Color = Pulse.Teal): Color = try {
    if (hex == null) fallback else Color(android.graphics.Color.parseColor(hex))
} catch (_: IllegalArgumentException) { fallback }

@Composable
fun PulseTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Pulse.Teal, onPrimary = Pulse.Ground, secondary = Pulse.Amber,
            background = Pulse.Ground, onBackground = Pulse.Text, surface = Pulse.Surface, onSurface = Pulse.Text,
            surfaceVariant = Pulse.Raised, onSurfaceVariant = Pulse.Soft, outline = Pulse.Line,
        ),
        content = content,
    )
}
