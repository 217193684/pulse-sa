package za.co.pulsesa.ui

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import kotlinx.coroutines.launch
import za.co.pulsesa.data.Api
import za.co.pulsesa.data.Clip
import java.io.IOException

/**
 * Bulk posting: pick an app, then every video not yet posted there goes out one after another
 * (oldest first, so your feed reads in order). Each tap sends the next one with its caption copied.
 * Apps like TikTok only take one video per post, so that last tap in their app is still yours.
 */
@Composable
fun BulkPost(clips: List<Clip>, onChanged: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var target by remember { mutableStateOf<Target?>(null) }
    var queue by remember { mutableStateOf<List<Clip>>(emptyList()) }
    var done by remember { mutableIntStateOf(0) }
    var busy by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Pulse.Ground).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        val t = target
        if (t == null || done >= queue.size) {
            if (t != null && queue.isNotEmpty()) Text("✓ All ${queue.size} sent to ${t.name}", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text("Post all new videos to", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(VIDEO_TARGETS.filter { it.pkg != null }) { tg ->
                    val n = clips.count { tg.id !in it.posted }
                    Text("${tg.name} ($n)", fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                        color = if (n > 0) Pulse.Text else Pulse.Muted,
                        modifier = Modifier.clip(RoundedCornerShape(50)).background(Pulse.Surface)
                            .clickable(enabled = n > 0) {
                                target = tg; done = 0
                                queue = clips.filter { tg.id !in it.posted }.sortedBy { it.createdAt }
                            }.padding(horizontal = 14.dp, vertical = 8.dp))
                }
            }
            val wa = clips.take(10)
            if (wa.isNotEmpty()) Text("Send the newest ${wa.size} to WhatsApp at once →", fontSize = 13.sp, color = Pulse.Teal,
                modifier = Modifier.clickable(enabled = !busy) { busy = true; scope.launch { sendAllAtOnce(ctx, wa); busy = false; onChanged() } }.padding(vertical = 4.dp))
        } else {
            val next = queue[done]
            Text("Posting to ${t.name}: ${done + 1} of ${queue.size}", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text("Next: ${next.title}", color = Pulse.Muted, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text("Tap Post next → it opens in ${t.name} with the caption copied → paste it and post → come back here.", color = Pulse.Muted, fontSize = 11.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Button(onClick = {
                    busy = true
                    scope.launch { if (shareClip(ctx, next.asCard(), t)) done++; busy = false; if (done >= queue.size) onChanged() }
                }, enabled = !busy, colors = ButtonDefaults.buttonColors(containerColor = Pulse.Teal)) {
                    Text(if (busy) "Preparing…" else "Post next", color = Pulse.Ground, fontWeight = FontWeight.Bold)
                }
                Text("Skip", color = Pulse.Muted, fontSize = 13.sp, modifier = Modifier.clickable { done++ }.padding(8.dp))
                Text("Stop", color = Pulse.Muted, fontSize = 13.sp, modifier = Modifier.clickable { target = null; queue = emptyList(); onChanged() }.padding(8.dp))
            }
        }
    }
}

/** WhatsApp (and some other apps) accept several videos in one go, e.g. for your Status. */
private suspend fun sendAllAtOnce(ctx: Context, clips: List<Clip>) {
    val uris = ArrayList<Uri>()
    for (c in clips) {
        try { uris += FileProvider.getUriForFile(ctx, ctx.packageName + ".files", Api(ctx).clipFile(c.id)) }
        catch (_: IOException) { /* skip one that won't download */ }
    }
    if (uris.isEmpty()) { Toast.makeText(ctx, "Couldn't download the videos", Toast.LENGTH_LONG).show(); return }
    val send = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
        type = "video/mp4"
        putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
        clipData = ClipData.newRawUri("videos", uris[0]).also { cd -> uris.drop(1).forEach { cd.addItem(ClipData.Item(it)) } }
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    try {
        if (isInstalled(ctx, "com.whatsapp")) ctx.startActivity(Intent(send).setPackage("com.whatsapp"))
        else ctx.startActivity(Intent.createChooser(send, "Send ${uris.size} videos to").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: ActivityNotFoundException) {
        ctx.startActivity(Intent.createChooser(send, "Send ${uris.size} videos to").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    for (c in clips) try { Api(ctx).logPost(c.id, "whatsapp") } catch (_: IOException) { }
}
