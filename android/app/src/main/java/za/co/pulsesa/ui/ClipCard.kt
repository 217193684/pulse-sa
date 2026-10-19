package za.co.pulsesa.ui

import android.view.ViewGroup
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import za.co.pulsesa.data.FeedCard

/** Sound on/off is remembered across cards, like TikTok. */
private var soundOn by mutableStateOf(true)

/**
 * One of our own videos, full-bleed. Plays (looping) only while it is the card on screen and the app is
 * in front; tap to pause. The Post button opens the share sheet with the MP4 + caption + hashtags.
 */
@OptIn(UnstableApi::class)
@Composable
fun ClipCardView(card: FeedCard, active: Boolean, onPost: () -> Unit) {
    val ctx = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var paused by rememberSaveable(card.id) { mutableStateOf(false) }
    var started by remember(card.id) { mutableStateOf(false) }
    var foreground by remember { mutableStateOf(lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) }

    val player = remember(card.id) {
        ExoPlayer.Builder(ctx).build().apply {
            repeatMode = Player.REPEAT_MODE_ONE
            card.videoUrl?.let { setMediaItem(MediaItem.fromUri(it)) }
            prepare()
            addListener(object : Player.Listener {
                override fun onRenderedFirstFrame() { started = true }
            })
        }
    }
    DisposableEffect(card.id) { onDispose { player.release() } }
    DisposableEffect(lifecycle) {
        val obs = LifecycleEventObserver { _, e ->
            if (e == Lifecycle.Event.ON_RESUME) foreground = true
            if (e == Lifecycle.Event.ON_PAUSE) foreground = false
        }
        lifecycle.addObserver(obs)
        onDispose { lifecycle.removeObserver(obs) }
    }
    LaunchedEffect(active, paused, foreground) {
        player.playWhenReady = active && !paused && foreground
        if (!active) { player.seekTo(0); paused = false }
    }
    LaunchedEffect(soundOn) { player.volume = if (soundOn) 1f else 0f }

    Box(Modifier.fillMaxSize().background(Color.Black)
        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { paused = !paused }) {
        AndroidView(factory = { c ->
            PlayerView(c).apply {
                useController = false
                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                setShutterBackgroundColor(android.graphics.Color.BLACK)
                this.player = player
            }
        }, modifier = Modifier.fillMaxSize())
        if (!started) AsyncImage(model = card.posterUrl, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        if (paused) Box(Modifier.align(Alignment.Center).size(84.dp).background(Color.Black.copy(alpha = 0.45f), CircleShape), contentAlignment = Alignment.Center) {
            Icon(Icons.Default.PlayArrow, "Play", tint = Color.White, modifier = Modifier.size(48.dp))
        }

        // bottom text, over a dark fade so it reads on any frame
        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth()
            .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.75f))))
            .padding(start = 16.dp, end = 80.dp, top = 40.dp, bottom = 34.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(7.dp).background(Color(0xFFFF3B3B), CircleShape))
                Spacer(Modifier.width(6.dp))
                Text("Pulse SA video · ${ago(card.updatedAt)}", color = Color.White.copy(alpha = 0.8f), fontSize = 12.sp)
            }
            Text(card.title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 17.sp, lineHeight = 21.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (card.hashtags.isNotEmpty()) Text(card.hashtags.take(6).joinToString(" "), color = Pulse.Teal, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (card.posted.isNotEmpty()) Text("✓ Posted to " + card.posted.joinToString(", ") { platformName(it) }, color = Pulse.Amber, fontSize = 12.sp)
        }

        Column(Modifier.align(Alignment.BottomEnd).padding(end = 10.dp, bottom = 60.dp), verticalArrangement = Arrangement.spacedBy(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally) {
            RailButton(if (soundOn) Icons.AutoMirrored.Filled.VolumeUp else Icons.AutoMirrored.Filled.VolumeOff, if (soundOn) "Mute" else "Sound on",
                bg = Color.Black.copy(alpha = 0.5f), tint = Color.White) { soundOn = !soundOn }
            RailButton(Icons.AutoMirrored.Filled.Send, "Post this video", bg = Pulse.Teal, tint = Pulse.Ground, onClick = onPost)
            Text("Post", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

fun platformName(id: String) = when (id) {
    "tiktok" -> "TikTok"; "instagram" -> "Instagram"; "youtube" -> "YouTube"; "facebook" -> "Facebook"
    "whatsapp" -> "WhatsApp"; "x" -> "X"; "linkedin" -> "LinkedIn"; else -> "other apps"
}
