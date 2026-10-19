package za.co.pulsesa.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import za.co.pulsesa.data.Api
import za.co.pulsesa.data.FeedCard
import za.co.pulsesa.data.ProblemDetail

private val SOURCE_LABEL = mapOf("news" to "News", "gdelt" to "News (GDELT)", "trends" to "Google search", "eskom" to "Eskom")

@Composable
fun DetailScreen(id: String, onBack: () -> Unit, onShare: (FeedCard) -> Unit) {
    val ctx = LocalContext.current
    var d by remember { mutableStateOf<ProblemDetail?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    LaunchedEffect(id, reload) {
        try { d = Api(ctx).problem(id); error = null } catch (e: Exception) { error = e.message ?: "Check your connection" }
    }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
            Spacer(Modifier.weight(1f))
            d?.let { p ->
                IconButton(onClick = { onShare(FeedCard(type = "problem", id = p.id, title = p.title, categoryLabel = p.categoryLabel, color = p.color, trend = p.trend, headline = p.signals.firstOrNull()?.title, publisher = p.signals.firstOrNull()?.publisher)) }) {
                    Icon(Icons.Default.Share, "Share", tint = Pulse.Teal)
                }
            }
        }
        val p = d
        when {
            p == null && error != null -> Problem(error!!) { reload++ }
            p == null -> Loading()
            else -> {
                val color = hexColor(p.color)
                LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    item {
                        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { Chip(p.categoryLabel, color); Chip(p.trend, color, filled = false) }
                            Text(p.title, fontSize = 24.sp, lineHeight = 28.sp, fontWeight = FontWeight.Bold)
                            Text("${p.signals.size} reports from ${p.sources} sources in the last 7 days", color = Pulse.Muted, fontSize = 13.sp)
                        }
                    }
                    item {
                        Column(Modifier.padding(horizontal = 12.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Pulse.Surface).padding(16.dp)) {
                            Text("Last 7 days", color = Pulse.Muted, fontSize = 12.sp)
                            Spacer(Modifier.height(10.dp))
                            val max = (p.days.maxOrNull() ?: 0.0).coerceAtLeast(1.0)
                            Row(Modifier.fillMaxWidth().height(80.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
                                p.days.forEachIndexed { i, v ->
                                    val frac = (v / max).toFloat().coerceAtLeast(0.04f)
                                    Box(Modifier.weight(1f).fillMaxHeight(frac).clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                                        .background(if (i == p.days.lastIndex) color else color.copy(alpha = 0.35f + 0.5f * frac)))
                                }
                            }
                            Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
                                Text("6 days ago", color = Pulse.Muted, fontSize = 11.sp)
                                Spacer(Modifier.weight(1f))
                                Text("Today", color = Pulse.Muted, fontSize = 11.sp)
                            }
                        }
                    }
                    if (p.hotspots.isNotEmpty()) item {
                        Box(Modifier.padding(horizontal = 12.dp).fillMaxWidth().height(220.dp).clip(RoundedCornerShape(20.dp)).background(Pulse.Surface)) {
                            SaMap(p.hotspots, color, Modifier.fillMaxSize().padding(8.dp))
                        }
                    }
                    item { Text("What's being reported", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 20.dp, top = 6.dp)) }
                    items(p.signals) { s ->
                        Column(Modifier.padding(horizontal = 12.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Pulse.Surface)
                            .clickable { openLink(ctx, s.url) }.padding(14.dp)) {
                            Text(s.title, fontSize = 14.sp, lineHeight = 19.sp)
                            Spacer(Modifier.height(4.dp))
                            Text(listOfNotNull(s.publisher, SOURCE_LABEL[s.source], ago(s.publishedAt)).distinct().joinToString(" · "), color = Pulse.Muted, fontSize = 12.sp)
                        }
                    }
                    item {
                        Button(
                            onClick = { onShare(FeedCard(type = "problem", id = p.id, title = p.title, categoryLabel = p.categoryLabel, color = p.color, trend = p.trend, headline = p.signals.firstOrNull()?.title, publisher = p.signals.firstOrNull()?.publisher)) },
                            colors = ButtonDefaults.buttonColors(containerColor = Pulse.Amber, contentColor = Pulse.Ground),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.padding(12.dp).fillMaxWidth().height(52.dp),
                        ) { Text("Post this", fontWeight = FontWeight.Bold) }
                    }
                }
            }
        }
    }
}
