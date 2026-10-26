package za.co.pulsesa.ui

import android.app.DownloadManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import za.co.pulsesa.data.Api
import za.co.pulsesa.data.Explainer
import za.co.pulsesa.data.Prefs

/**
 * The Explain tab: long explainer videos. Ask for one about any topic, watch the finished ones,
 * pick a thumbnail and send it to YouTube, or download it to post by hand.
 */
@Composable
fun ExplainScreen(askTopic: String? = null, onAsked: () -> Unit = {}) {
    val ctx = LocalContext.current
    val api = remember { Api(ctx) }
    var list by remember { mutableStateOf<List<Explainer>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var open by rememberSaveable { mutableStateOf<String?>(null) }
    var tick by remember { mutableIntStateOf(0) }
    val refresh: () -> Unit = { tick++ }

    LaunchedEffect(tick) {
        try { list = api.explainers(); error = null } catch (e: Exception) { error = e.message }
    }
    // keep checking while something is being made or sent
    LaunchedEffect(list) {
        if (list?.any { it.status in setOf("queued", "making", "send", "sending") } == true) { delay(30_000); tick++ }
    }

    val current = list?.firstOrNull { it.id == open }
    if (current != null) {
        BackHandler { open = null }
        ExplainerDetail(current, onBack = { open = null }, onChanged = refresh)
        return
    }
    Column(Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Text("Explain", fontSize = 26.sp, fontWeight = FontWeight.Bold)
                Text("Long videos that explain why things happen and what people can do.", color = Pulse.Muted, fontSize = 13.sp)
            }
            item { AskBox(askTopic, onAsked = { onAsked(); refresh() }) }
            if (error != null) item { Problem(error!!) { refresh() } }
            if (list == null && error == null) item { Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Pulse.Teal) } }
            list?.let { all ->
                if (all.isEmpty()) item { Text("No explainers yet. The first one is made every morning, or ask for one above.", color = Pulse.Muted) }
                items(all, key = { it.id }) { e -> ExplainerRow(e) { if (e.status !in setOf("queued", "making") || e.videoUrl != null) open = e.id } }
            }
        }
    }
}

@Composable
private fun AskBox(prefill: String?, onAsked: () -> Unit) {
    val ctx = LocalContext.current
    val api = remember { Api(ctx) }
    val scope = rememberCoroutineScope()
    var topic by remember(prefill) { mutableStateOf(prefill ?: "") }
    var busy by remember { mutableStateOf(false) }
    val hasKey = remember { Prefs(ctx).ownerKey.isNotBlank() }
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Pulse.Surface).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Make an explainer about…", fontWeight = FontWeight.SemiBold)
        OutlinedTextField(value = topic, onValueChange = { topic = it }, minLines = 2, modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("e.g. Why are taxi fares going up in Durban?") })
        if (!hasKey) Text("Add your owner key under Me first (it's the ADMIN_TOKEN password you made in Vercel).", color = Pulse.Amber, fontSize = 12.sp)
        Button(
            enabled = !busy && topic.trim().length >= 5,
            onClick = {
                busy = true
                scope.launch {
                    try {
                        api.requestExplainer(topic.trim())
                        Toast.makeText(ctx, "Asked! Research and animation take about 30-60 minutes. You'll get a notification.", Toast.LENGTH_LONG).show()
                        topic = ""; onAsked()
                    } catch (e: Exception) { Toast.makeText(ctx, e.message ?: "Couldn't ask", Toast.LENGTH_LONG).show() }
                    busy = false
                }
            },
            colors = ButtonDefaults.buttonColors(containerColor = Pulse.Teal, contentColor = Pulse.Ground),
        ) { Text(if (busy) "Asking…" else "Research & make video") }
    }
}

private fun statusLabel(e: Explainer): Pair<String, Color> = when (e.status) {
    "queued" -> "Waiting to start" to Pulse.Muted
    "making" -> "Researching & animating…" to Pulse.Amber
    "ready" -> "Ready to watch" to Pulse.Teal
    "send" -> "Sending to YouTube soon…" to Pulse.Amber
    "sending" -> "Uploading to YouTube…" to Pulse.Amber
    "on_youtube" -> "On YouTube" to Color(0xFF34D399)
    "failed" -> "Problem — tap for details" to Color(0xFFF87171)
    else -> e.status to Pulse.Muted
}

@Composable
private fun ExplainerRow(e: Explainer, onClick: () -> Unit) {
    val (label, color) = statusLabel(e)
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Pulse.Surface).clickable(onClick = onClick).padding(10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(140.dp).aspectRatio(16f / 9f).clip(RoundedCornerShape(10.dp)).background(Pulse.Raised), contentAlignment = Alignment.Center) {
            if (e.thumbs.isNotEmpty()) AsyncImage(model = e.thumbs[e.thumb ?: 0], contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            else if (e.status in setOf("queued", "making")) CircularProgressIndicator(color = Pulse.Teal, modifier = Modifier.size(28.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(e.title, fontWeight = FontWeight.SemiBold, maxLines = 3, overflow = TextOverflow.Ellipsis, lineHeight = 18.sp)
            Text(listOfNotNull(e.minutes?.let { "%.1f min".format(it) }, if (e.source == "app") "asked by you" else "daily", ago(e.createdAt)).joinToString(" · "),
                color = Pulse.Muted, fontSize = 12.sp)
            Text(label, color = color, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@OptIn(UnstableApi::class)
@Composable
private fun ExplainerDetail(e: Explainer, onBack: () -> Unit, onChanged: () -> Unit) {
    val ctx = LocalContext.current
    val api = remember { Api(ctx) }
    val scope = rememberCoroutineScope()
    var thumb by remember(e.id) { mutableIntStateOf(e.thumb ?: 0) }
    var privacy by remember(e.id) { mutableStateOf(e.privacy ?: "public") }
    var busy by remember { mutableStateOf(false) }
    val player = remember(e.previewUrl) {
        ExoPlayer.Builder(ctx).build().apply { e.previewUrl?.let { setMediaItem(MediaItem.fromUri(it)); prepare() } }
    }
    DisposableEffect(player) { onDispose { player.release() } }
    val (label, color) = statusLabel(e)

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
            Text(label, color = color, fontWeight = FontWeight.SemiBold)
        }
        Text(e.title, fontSize = 22.sp, fontWeight = FontWeight.Bold, lineHeight = 28.sp)
        if (e.previewUrl != null) {
            AndroidView(factory = { c -> PlayerView(c).apply { this.player = player } },
                modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(14.dp)).background(Color.Black))
            Text("Watch and listen before you send it.", color = Pulse.Muted, fontSize = 12.sp)
        }
        e.error?.let { Text(it, color = Color(0xFFF87171), fontSize = 13.sp) }

        if (e.thumbs.isNotEmpty()) {
            Text("Pick a thumbnail", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
            e.thumbs.forEachIndexed { i, url ->
                val selected = i == thumb
                Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(14.dp))
                    .border(if (selected) BorderStroke(4.dp, Pulse.Teal) else BorderStroke(1.dp, Pulse.Line), RoundedCornerShape(14.dp))
                    .clickable { thumb = i }) {
                    AsyncImage(model = url, contentDescription = "Thumbnail ${i + 1}", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                    if (selected) Icon(Icons.Default.CheckCircle, null, tint = Pulse.Teal, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp).size(34.dp))
                }
            }
        }

        if (e.videoUrl != null) {
            Text("Who can see it on YouTube", fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("public" to "Public", "unlisted" to "Unlisted", "private" to "Private").forEach { (v, l) ->
                    val on = privacy == v
                    OutlinedButton(onClick = { privacy = v }, border = BorderStroke(if (on) 2.dp else 1.dp, if (on) Pulse.Teal else Pulse.Line),
                        colors = ButtonDefaults.outlinedButtonColors(containerColor = if (on) Pulse.Raised else Color.Transparent, contentColor = Pulse.Text)) { Text(l) }
                }
            }
            val sending = e.status in setOf("send", "sending")
            Button(
                enabled = !busy && !sending,
                onClick = {
                    busy = true
                    scope.launch {
                        try {
                            api.sendExplainer(e.id, thumb, privacy)
                            Toast.makeText(ctx, "Sending… it starts within a few minutes. You'll get a notification when it's on YouTube.", Toast.LENGTH_LONG).show()
                            onChanged()
                        } catch (x: Exception) { Toast.makeText(ctx, x.message ?: "Couldn't send", Toast.LENGTH_LONG).show() }
                        busy = false
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE53935), contentColor = Color.White),
            ) { Text(if (sending) "Sending to YouTube…" else if (e.status == "on_youtube") "Send to YouTube again" else "Send to YouTube", fontSize = 16.sp) }
            e.youtubeId?.let { id ->
                OutlinedButton(onClick = { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://youtu.be/$id"))) }, modifier = Modifier.fillMaxWidth()) { Text("Open on YouTube") }
            }

            Text("Post it yourself (Facebook, X, TikTok, WhatsApp)", fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { download(ctx, e.previewUrl ?: e.videoUrl, "${e.id}.mp4") }, modifier = Modifier.weight(1f)) { Text("Download") }
                OutlinedButton(onClick = { download(ctx, e.videoUrl, "${e.id}-HD.mp4") }, modifier = Modifier.weight(1f)) { Text("Download HD") }
            }
            OutlinedButton(onClick = {
                val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("Pulse SA", e.description ?: e.title))
                Toast.makeText(ctx, "Description with sources copied", Toast.LENGTH_SHORT).show()
            }, modifier = Modifier.fillMaxWidth()) { Text("Copy description & sources") }
            OutlinedButton(onClick = {
                e.thumbs.getOrNull(thumb)?.let { download(ctx, it, "${e.id}-thumbnail.jpg") }
            }, modifier = Modifier.fillMaxWidth()) { Text("Download this thumbnail") }
        }
    }
}

/** Saves a file to the phone's Downloads/PulseSA folder (the system shows progress in the notification bar). */
private fun download(ctx: Context, url: String?, name: String) {
    if (url == null) return
    val req = DownloadManager.Request(Uri.parse(url))
        .setTitle(name).setDescription("Pulse SA explainer")
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "PulseSA/$name")
    (ctx.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
    Toast.makeText(ctx, "Downloading to Downloads/PulseSA…", Toast.LENGTH_SHORT).show()
}
