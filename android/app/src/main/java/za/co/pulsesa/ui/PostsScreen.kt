package za.co.pulsesa.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import coil.compose.AsyncImage
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.runtime.mutableIntStateOf
import za.co.pulsesa.data.Clip
import za.co.pulsesa.data.PostLogItem
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.launch
import za.co.pulsesa.data.Api
import za.co.pulsesa.data.FeedCard
import za.co.pulsesa.data.Prefs
import za.co.pulsesa.data.Top3
import za.co.pulsesa.work.DailyPost

/** Bottom sheet: pick where to share one problem. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareSheet(card: FeedCard, caption: String? = null, onDismiss: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    if (card.type == "clip") { ClipShareSheet(card, onDismiss); return }
    val text = caption ?: captionFor(card, Prefs(ctx).serverUrl)
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Pulse.Surface) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Share this problem", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Text(card.title, color = Pulse.Soft)
            Text("Shares a 1080×1350 image with the map plus a ready-made caption.", color = Pulse.Muted, fontSize = 12.sp)
            TargetGrid(busy) { t ->
                busy = true
                scope.launch { shareCard(ctx, card, text, t); busy = false; onDismiss() }
            }
        }
    }
}

/** Bottom sheet: post one of our videos (MP4 + caption + hashtags) to an app. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClipShareSheet(card: FeedCard, onDismiss: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Pulse.Surface) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Post this video", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Text(card.title, color = Pulse.Soft)
            Text(card.hashtags.joinToString(" "), color = Pulse.Teal, fontSize = 13.sp)
            if (card.posted.isNotEmpty()) Text("Already posted to " + card.posted.joinToString(", ") { platformName(it) } + ". Posting it there again would be a repeat.",
                color = Pulse.Amber, fontSize = 12.sp)
            Text("Sends the video. The caption and hashtags are copied, so just paste them.", color = Pulse.Muted, fontSize = 12.sp)
            TargetGrid(busy, VIDEO_TARGETS, done = card.posted) { t ->
                busy = true
                scope.launch { shareClip(ctx, card, t); busy = false; onDismiss() }
            }
        }
    }
}

@Composable
private fun TargetGrid(busy: Boolean, targets: List<Target> = TARGETS, done: List<String> = emptyList(), onPick: (Target) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        targets.chunked(4).forEach { row ->
            Row(Modifier.fillMaxWidth()) {
                row.forEach { t ->
                    Column(Modifier.weight(1f).clickable(enabled = !busy) { onPick(t) }, horizontalAlignment = Alignment.CenterHorizontally) {
                        val isDone = t.pkg != null && t.id in done
                        Box(Modifier.size(52.dp).clip(RoundedCornerShape(16.dp)).background(if (t.pkg == null) Pulse.Amber else Pulse.Raised)
                            .border(if (isDone) 2.dp else 0.dp, if (isDone) Pulse.Teal else Color.Transparent, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) {
                            Text(t.mark, fontWeight = FontWeight.Bold, color = if (t.pkg == null) Pulse.Ground else Pulse.Text)
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(if (isDone) "✓ " + t.name else t.name, fontSize = 11.sp, color = if (isDone) Pulse.Teal else Pulse.Soft)
                    }
                }
                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
        if (busy) Text("Preparing…", color = Pulse.Muted, fontSize = 12.sp)
    }
}

@Composable
fun PostsScreen(onOpen: (String) -> Unit) {
    val ctx = LocalContext.current
    val prefs = remember { Prefs(ctx) }
    val scope = rememberCoroutineScope()
    var top by remember { mutableStateOf<Top3?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var daily by remember { mutableStateOf(prefs.dailyPost) }
    var hour by remember { mutableStateOf(prefs.postHour) }
    var plats by remember { mutableStateOf(prefs.platforms) }
    var busy by remember { mutableStateOf(false) }

    val askNotify = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        daily = granted; prefs.dailyPost = granted
        if (granted) DailyPost.schedule(ctx, hour) else DailyPost.cancel(ctx)
    }
    var clips by remember { mutableStateOf<List<Clip>?>(null) }
    var log by remember { mutableStateOf<List<PostLogItem>>(emptyList()) }
    var posting by remember { mutableStateOf<Clip?>(null) }
    var refresh by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) { try { top = Api(ctx).top3() } catch (e: Exception) { error = e.message } }
    LaunchedEffect(refresh) {
        try { clips = Api(ctx).clips() } catch (_: Exception) { if (clips == null) clips = emptyList() }
        try { log = Api(ctx).postLog() } catch (_: Exception) { }
    }
    posting?.let { c -> ClipShareSheet(c.asCard()) { posting = null; refresh++ } }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp)) {
            Text("Share & auto-post", fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Text("Turn what's trending on Pulse SA into posts for your accounts.", color = Pulse.Muted, fontSize = 13.sp)
        }

        Column(Modifier.padding(horizontal = 12.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Pulse.Surface).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("News videos", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            Text("Made automatically within minutes of a story breaking (up to 20 a day), with music, real photos and hashtags. New ones also go to your YouTube news channel by themselves.", color = Pulse.Muted, fontSize = 12.sp)
            val cl = clips
            when {
                cl == null -> Text("Loading…", color = Pulse.Muted, fontSize = 13.sp)
                cl.isEmpty() -> Text("No videos yet. They appear here within minutes of a big story.", color = Pulse.Muted, fontSize = 13.sp)
                else -> {
                    BulkPost(cl) { refresh++ }
                    cl.take(12).forEach { c -> ClipRow(c) { posting = c } }
                }
            }
        }

        Column(Modifier.padding(horizontal = 12.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Pulse.Surface).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Today's top 3", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            val t = top
            when {
                t == null && error != null -> Text("Couldn't load: $error", color = Pulse.Muted, fontSize = 13.sp)
                t == null -> Text("Loading…", color = Pulse.Muted, fontSize = 13.sp)
                t.cards.isEmpty() -> Text("Nothing trending yet today.", color = Pulse.Muted, fontSize = 13.sp)
                else -> {
                    t.cards.forEachIndexed { i, c ->
                        Row(Modifier.fillMaxWidth().clickable { onOpen(c.id) }, verticalAlignment = Alignment.CenterVertically) {
                            Text("${i + 1}", color = hexColor(c.color), fontWeight = FontWeight.Bold, modifier = Modifier.width(22.dp))
                            Column(Modifier.weight(1f)) {
                                Text(c.title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                Text(c.trend ?: "", color = Pulse.Muted, fontSize = 12.sp)
                            }
                        }
                    }
                    Text("Post it to", color = Pulse.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
                    TargetGrid(busy) { target ->
                        busy = true
                        scope.launch { shareCard(ctx, t.cards.first(), t.caption, target); busy = false }
                    }
                }
            }
        }

        if (log.isNotEmpty()) Column(Modifier.padding(horizontal = 12.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Pulse.Surface).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Post log", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            Text("Everything that went out, and every repeat that was stopped.", color = Pulse.Muted, fontSize = 12.sp)
            log.take(20).forEach { l -> LogRow(l) }
        }

        Column(Modifier.padding(horizontal = 12.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Pulse.Surface).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Daily post", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    Text("Every day Pulse SA prepares the top 3 as a post and reminds you. One tap sends it.", color = Pulse.Muted, fontSize = 12.sp)
                }
                Switch(checked = daily, onCheckedChange = { on ->
                    if (on && Build.VERSION.SDK_INT >= 33 &&
                        ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
                    } else {
                        daily = on; prefs.dailyPost = on
                        if (on) DailyPost.schedule(ctx, hour) else DailyPost.cancel(ctx)
                    }
                }, colors = SwitchDefaults.colors(checkedTrackColor = Pulse.Teal, checkedThumbColor = Pulse.Text))
            }
            Text("Time", color = Pulse.Muted, fontSize = 12.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(7, 12, 18, 20).forEach { h ->
                    Pill("%02d:00".format(h), h == hour) { hour = h; prefs.postHour = h; if (daily) DailyPost.schedule(ctx, h) }
                }
            }
            Text("Platforms", color = Pulse.Muted, fontSize = 12.sp)
            TARGETS.filter { it.pkg != null }.chunked(3).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { t ->
                        val on = t.name in plats
                        Pill((if (on) "✓ " else "+ ") + t.name, on) { plats = if (on) plats - t.name else plats + t.name; prefs.platforms = plats }
                    }
                }
            }
            Text(
                "Fully automatic posting (no tap at all) needs each platform to approve the app first: TikTok, Instagram and Facebook through Meta, and X through its paid API. Until then, Pulse SA gets everything ready and you tap once.",
                color = Pulse.Muted, fontSize = 12.sp, lineHeight = 16.sp,
            )
            if (daily) Button(
                onClick = { DailyPost.runNow(ctx) },
                colors = ButtonDefaults.buttonColors(containerColor = Pulse.Raised, contentColor = Pulse.Text), shape = RoundedCornerShape(14.dp),
            ) { Text("Send me the reminder now (test)") }
        }
    }
}

@Composable
fun Pill(text: String, on: Boolean, onClick: () -> Unit) {
    Text(
        text, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center,
        color = if (on) Pulse.Teal else Pulse.Muted,
        modifier = Modifier.clip(RoundedCornerShape(50)).background(if (on) Pulse.Teal.copy(alpha = 0.12f) else Pulse.Ground)
            .border(1.dp, if (on) Pulse.Teal else Pulse.Line, RoundedCornerShape(50)).clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 9.dp),
    )
}

@Composable
private fun ClipRow(c: Clip, onPost: () -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Pulse.Ground).clickable(onClick = onPost).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        AsyncImage(model = c.posterUrl, contentDescription = null, contentScale = ContentScale.Crop,
            modifier = Modifier.width(64.dp).aspectRatio(9f / 16f).clip(RoundedCornerShape(10.dp)).background(Color.Black))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(c.title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(c.hashtags.take(4).joinToString(" "), color = Pulse.Teal, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(if (c.posted.isEmpty()) "Not posted yet" else "✓ " + c.posted.joinToString(", ") { platformName(it) },
                color = if (c.posted.isEmpty()) Pulse.Muted else Pulse.Amber, fontSize = 12.sp)
        }
        Text("Post", color = Pulse.Ground, fontWeight = FontWeight.Bold, fontSize = 13.sp,
            modifier = Modifier.clip(RoundedCornerShape(50)).background(Pulse.Teal).padding(horizontal = 14.dp, vertical = 8.dp))
    }
}

@Composable
private fun LogRow(l: PostLogItem) {
    val skipped = l.status == "skipped_duplicate"
    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(if (skipped) "⊘" else "✓", color = if (skipped) Pulse.Amber else Pulse.Teal, fontWeight = FontWeight.Bold, modifier = Modifier.width(16.dp))
        Column(Modifier.weight(1f)) {
            Text(
                if (skipped) "Repeat stopped: " + (l.title ?: storyName(l.storyKey)) else (l.title ?: storyName(l.storyKey)) + " → " + platformName(l.platform),
                fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis,
            )
            Text((if (skipped && l.detail != null) l.detail + " · " else "") + ago(l.createdAt), color = Pulse.Muted, fontSize = 11.sp, maxLines = 2)
        }
    }
}

/** "power~johannesburg" → "Power · Johannesburg" */
private fun storyName(key: String) = key.split("~").joinToString(" · ") { part ->
    if (part == "za") "South Africa" else part.split("-").joinToString(" ") { w -> w.replaceFirstChar { it.uppercase() } }
}
