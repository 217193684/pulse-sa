package za.co.pulsesa.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import za.co.pulsesa.data.Api
import za.co.pulsesa.data.MapResponse

val LAYERS = listOf(
    "water" to "Water", "power" to "Power", "transport" to "Transport", "education" to "Education", "jobs" to "Jobs",
    "grants" to "Grants", "cost" to "Cost of living", "health" to "Health", "safety" to "Safety",
)

@Composable
fun MapScreen(onOpen: (String) -> Unit) {
    val ctx = LocalContext.current
    var layer by rememberSaveable { mutableStateOf("water") }
    var data by remember { mutableStateOf<MapResponse?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableIntStateOf(0) }

    LaunchedEffect(layer, reload) {
        try { data = Api(ctx).map(layer); error = null } catch (e: Exception) { error = e.message ?: "Check your connection" }
    }
    val m = data
    val color = hexColor(m?.color)

    LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Column(Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp)) {
                Text("Live map", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text("Where South Africa is struggling, by place. Pinch to zoom.", color = Pulse.Muted, fontSize = 13.sp)
            }
        }
        item {
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LAYERS.forEach { (id, label) ->
                    val on = id == layer
                    val c = hexColor(m?.layers?.firstOrNull { it.id == id }?.color, Pulse.Teal)
                    val count = m?.layers?.firstOrNull { it.id == id }?.signals ?: 0
                    Text(
                        if (count > 0) "$label · $count" else label,
                        fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = if (on) Pulse.Ground else Pulse.Soft,
                        modifier = Modifier.clip(RoundedCornerShape(50))
                            .then(if (on) Modifier.background(c) else Modifier.border(1.dp, Pulse.Line, RoundedCornerShape(50)))
                            .clickable { layer = id }.padding(horizontal = 14.dp, vertical = 9.dp),
                    )
                }
            }
        }
        item {
            Box(Modifier.padding(horizontal = 12.dp).fillMaxWidth().height(330.dp).clip(RoundedCornerShape(24.dp)).background(Pulse.Surface)
                .border(1.dp, Pulse.Line, RoundedCornerShape(24.dp))) {
                when {
                    m != null -> SaMap(m.hotspots, color, Modifier.fillMaxSize().padding(10.dp), interactive = true)
                    error != null -> Problem(error!!) { reload++ }
                    else -> Loading()
                }
            }
        }
        item {
            Row(Modifier.padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Normal", color = Pulse.Muted, fontSize = 11.sp)
                Box(Modifier.padding(horizontal = 8.dp).width(120.dp).height(6.dp).clip(RoundedCornerShape(3.dp))
                    .background(Brush.horizontalGradient(listOf(Pulse.Raised, color.copy(alpha = 0.5f), color))))
                Text("Much more than usual", color = Pulse.Muted, fontSize = 11.sp)
            }
        }
        if (m != null) {
            item { Text("Rising right now · ${m.label}", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 20.dp, top = 6.dp)) }
            if (m.rising.isEmpty()) item {
                Text(
                    if (m.nationalSignals > 0) "${m.nationalSignals} national reports today, none tied to a specific town yet." else "Nothing reported for this in the last 24 hours.",
                    color = Pulse.Muted, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 20.dp),
                )
            }
            items(m.rising, key = { it.id }) { r ->
                Row(Modifier.padding(horizontal = 12.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Pulse.Surface)
                    .clickable { onOpen(r.id) }.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(30.dp).background(Pulse.Raised, CircleShape), contentAlignment = Alignment.Center) {
                        Text("${m.rising.indexOf(r) + 1}", color = color, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(r.name, fontWeight = FontWeight.SemiBold)
                        Text(r.headline, color = Pulse.Muted, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = Pulse.Muted)
                }
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}
