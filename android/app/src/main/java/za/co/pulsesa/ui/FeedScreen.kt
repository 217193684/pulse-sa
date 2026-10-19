package za.co.pulsesa.ui

import android.annotation.SuppressLint
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import coil.compose.AsyncImage
import kotlinx.coroutines.launch
import za.co.pulsesa.data.Api
import za.co.pulsesa.data.FeedCard
import za.co.pulsesa.data.Prefs

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(onOpen: (String) -> Unit, onShare: (FeedCard) -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var cards by remember { mutableStateOf<List<FeedCard>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshing by remember { mutableStateOf(false) }
    var reload by remember { mutableIntStateOf(0) }

    LaunchedEffect(reload) {
        try { cards = Api(ctx).feed().cards; error = null }
        catch (e: Exception) { error = e.message ?: "Check your connection" }
        refreshing = false
    }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 8.dp, top = 12.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Brand()
            Spacer(Modifier.weight(1f))
            IconButton(onClick = { refreshing = true; reload++ }) { Icon(Icons.Default.Refresh, "Refresh", tint = Pulse.Soft) }
        }
        val list = cards
        when {
            list == null && error != null -> Problem(error!!) { reload++ }
            list == null -> Loading()
            list.isEmpty() -> Problem("Nothing collected yet. The server gathers fresh data every 30 minutes.") { reload++ }
            else -> PullToRefreshBox(isRefreshing = refreshing, onRefresh = { refreshing = true; reload++ }, modifier = Modifier.fillMaxSize()) {
                val pager = rememberPagerState { list.size }
                VerticalPager(state = pager, modifier = Modifier.fillMaxSize(), beyondViewportPageCount = 1) { i ->
                    val card = list[i]
                    Box(Modifier.fillMaxSize().padding(start = 12.dp, end = 12.dp, top = 4.dp, bottom = 12.dp)
                        .clip(RoundedCornerShape(24.dp)).background(Pulse.Surface).border(1.dp, Pulse.Line, RoundedCornerShape(24.dp))) {
                        when (card.type) {
                            "clip" -> ClipCardView(card, active = pager.settledPage == i, onPost = { onShare(card) })
                            "trending" -> TrendingCardView(card)
                            "video" -> VideoCardView(card)
                            else -> ProblemCardView(card, i + 1, list.size, onOpen = { onOpen(card.id) }, onShare = { onShare(card) })
                        }
                        if (i < list.size - 1 && card.type != "clip") {
                            Row(Modifier.align(Alignment.BottomCenter).padding(bottom = 6.dp).clickable { scope.launch { pager.animateScrollToPage(i + 1) } },
                                verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.KeyboardArrowUp, null, tint = Pulse.Muted, modifier = Modifier.size(18.dp))
                                Text("Swipe up for the next one", color = Pulse.Muted, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProblemCardView(card: FeedCard, pos: Int, count: Int, onOpen: () -> Unit, onShare: () -> Unit) {
    val ctx = LocalContext.current
    val color = hexColor(card.color)
    var saved by remember { mutableStateOf(card.id in Prefs(ctx).saved) }
    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(7.dp).background(color, CircleShape))
                Spacer(Modifier.width(6.dp))
                Text("Live · updated ${ago(card.updatedAt)}", color = Pulse.Muted, fontSize = 12.sp)
                Spacer(Modifier.weight(1f))
                Text("$pos / $count", color = Pulse.Muted, fontSize = 12.sp)
            }
            SaMap(card.hotspots, color, Modifier.fillMaxWidth().weight(1f).padding(horizontal = 8.dp))
            Column(Modifier.padding(start = 18.dp, end = 76.dp, bottom = 34.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Chip(card.categoryLabel ?: "", color)
                    card.trend?.let { Chip(it, color, filled = false) }
                }
                Text(card.title, fontSize = 24.sp, lineHeight = 28.sp, fontWeight = FontWeight.Bold, color = Pulse.Text)
                if (!card.headline.isNullOrBlank()) Text(
                    "“${card.headline}”" + (card.publisher?.let { " — $it" } ?: ""),
                    color = Pulse.Soft, fontSize = 14.sp, lineHeight = 19.sp, maxLines = 3, overflow = TextOverflow.Ellipsis,
                )
                Sparkline(card.spark, color, Modifier.width(180.dp).height(30.dp))
                Row(Modifier.clickable(onClick = onOpen), verticalAlignment = Alignment.CenterVertically) {
                    Text("See why it's rising", color = Pulse.Teal, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, null, tint = Pulse.Teal, modifier = Modifier.size(16.dp))
                }
            }
        }
        Column(Modifier.align(Alignment.BottomEnd).padding(end = 10.dp, bottom = 60.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            RailButton(if (saved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, if (saved) "Saved" else "Save") {
                val p = Prefs(ctx)
                p.saved = if (saved) p.saved - card.id else p.saved + card.id
                saved = !saved
            }
            RailButton(Icons.Default.Lightbulb, "What's behind this", tint = Pulse.Amber, onClick = onOpen)
            RailButton(Icons.Default.Share, "Share", bg = Pulse.Teal, tint = Pulse.Ground, onClick = onShare)
        }
    }
}

@Composable
fun RailButton(icon: ImageVector, label: String, bg: Color = Pulse.Raised, tint: Color = Pulse.Text, onClick: () -> Unit) {
    IconButton(onClick = onClick, modifier = Modifier.size(48.dp).background(bg, CircleShape)) { Icon(icon, label, tint = tint) }
}

@Composable
private fun TrendingCardView(card: FeedCard) {
    val ctx = LocalContext.current
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Search, null, tint = Pulse.Teal)
            Spacer(Modifier.width(8.dp))
            Text("Google Trends · South Africa", color = Pulse.Muted, fontSize = 12.sp)
        }
        Text(card.title, fontSize = 24.sp, lineHeight = 28.sp, fontWeight = FontWeight.Bold)
        card.items.forEachIndexed { i, t ->
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Pulse.Ground).clickable { openLink(ctx, t.url) }.padding(14.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text("${i + 1}", color = Pulse.Teal, fontWeight = FontWeight.Bold, modifier = Modifier.width(24.dp))
                Column(Modifier.weight(1f)) {
                    Text(t.query, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (t.traffic > 0) Text(traffic(t.traffic), color = Pulse.Muted, fontSize = 12.sp)
                }
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun VideoCardView(card: FeedCard) {
    val ctx = LocalContext.current
    var playing by remember(card.id) { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Video" + (card.creator?.let { " · $it" } ?: ""), color = Pulse.Muted, fontSize = 12.sp)
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(18.dp)).background(Pulse.Raised), contentAlignment = Alignment.Center) {
            if (playing && card.youtubeId != null) {
                val html = """<html><body style="margin:0;background:#000"><iframe width="100%" height="100%" style="position:absolute;inset:0;border:0"
                    src="https://www.youtube-nocookie.com/embed/${card.youtubeId}?autoplay=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></body></html>"""
                AndroidView(factory = { c ->
                    WebView(c).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.mediaPlaybackRequiresUserGesture = false
                        webChromeClient = WebChromeClient()
                        loadDataWithBaseURL("https://pulse-sa.app", html, "text/html", "utf-8", null)
                    }
                }, modifier = Modifier.fillMaxSize())
            } else {
                AsyncImage(model = card.thumbnail, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                IconButton(onClick = { playing = true }, modifier = Modifier.size(72.dp).background(Pulse.Text.copy(alpha = 0.92f), CircleShape)) {
                    Icon(Icons.Default.PlayArrow, "Play video", tint = Pulse.Ground, modifier = Modifier.size(36.dp))
                }
            }
        }
        Text(card.title, fontSize = 22.sp, lineHeight = 26.sp, fontWeight = FontWeight.Bold)
        Text("Open in YouTube", color = Pulse.Teal, fontWeight = FontWeight.SemiBold, fontSize = 14.sp,
            modifier = Modifier.clickable { openLink(ctx, "https://youtu.be/${card.youtubeId}") })
    }
}
