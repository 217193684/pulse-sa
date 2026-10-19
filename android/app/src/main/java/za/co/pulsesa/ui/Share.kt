package za.co.pulsesa.ui

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.core.content.FileProvider
import za.co.pulsesa.data.Api
import za.co.pulsesa.data.FeedCard
import java.io.IOException

/** A place to share to. `pkg` = the app's package; null = Android's own "share to any app" sheet. `id` matches the server's post log. */
data class Target(val name: String, val mark: String, val pkg: String?, val id: String = "other")

val TARGETS = listOf(
    Target("TikTok", "Tt", "com.zhiliaoapp.musically", "tiktok"),
    Target("Instagram", "Ig", "com.instagram.android", "instagram"),
    Target("X", "X", "com.twitter.android", "x"),
    Target("Facebook", "f", "com.facebook.katana", "facebook"),
    Target("WhatsApp", "Wa", "com.whatsapp", "whatsapp"),
    Target("LinkedIn", "in", "com.linkedin.android", "linkedin"),
    Target("More", "…", null),
)

/** Where our videos go: the short-video apps first. */
val VIDEO_TARGETS = listOf(
    Target("TikTok", "Tt", "com.zhiliaoapp.musically", "tiktok"),
    Target("Instagram", "Ig", "com.instagram.android", "instagram"),
    Target("YouTube", "▶", "com.google.android.youtube", "youtube"),
    Target("Facebook", "f", "com.facebook.katana", "facebook"),
    Target("WhatsApp", "Wa", "com.whatsapp", "whatsapp"),
    Target("X", "X", "com.twitter.android", "x"),
    Target("More", "…", null),
)

/** Caption + hashtags exactly as they should be posted. */
fun clipCaption(card: FeedCard): String {
    val cap = card.caption.orEmpty().trim()
    val missing = card.hashtags.filter { !cap.contains(it, ignoreCase = true) }
    return if (missing.isEmpty()) cap else (cap + "\n\n" + missing.joinToString(" ")).trim()
}

/**
 * Posts one of our videos: downloads the MP4, copies the caption + hashtags to the clipboard
 * (TikTok and Instagram ignore captions passed in, so you paste it), opens the app, and logs it.
 */
suspend fun shareClip(ctx: Context, card: FeedCard, target: Target?): Boolean {
    val id = card.clipId ?: return false
    val file = try { Api(ctx).clipFile(id) } catch (e: IOException) {
        Toast.makeText(ctx, e.message ?: "Couldn't download the video", Toast.LENGTH_LONG).show(); return false
    }
    val caption = clipCaption(card)
    (ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Pulse SA caption", caption))
    Toast.makeText(ctx, "Caption and hashtags copied. Paste them in the post", Toast.LENGTH_LONG).show()
    val uri: Uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", file)
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "video/mp4"
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_TEXT, caption)
        putExtra(Intent.EXTRA_TITLE, card.title)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    val pkg = target?.pkg
    try {
        if (pkg != null && isInstalled(ctx, pkg)) ctx.startActivity(send.setPackage(pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        else {
            if (pkg != null) Toast.makeText(ctx, "${target.name} isn't installed, pick another app", Toast.LENGTH_SHORT).show()
            ctx.startActivity(Intent.createChooser(send, "Post video to").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    } catch (_: ActivityNotFoundException) {
        ctx.startActivity(Intent.createChooser(send, "Post video to").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    try { Api(ctx).logPost(id, target?.id ?: "other") } catch (_: IOException) { /* the post itself still went out */ }
    return true
}

fun captionFor(card: FeedCard, server: String): String = buildString {
    append(card.title)
    card.trend?.let { append(" (").append(it.lowercase()).append(")") }
    card.headline?.takeIf { it.isNotBlank() }?.let { append("\n\n“").append(it).append("”") ; card.publisher?.let { p -> append(" — ").append(p) } }
    append("\n\nLive map of what South Africa is struggling with: Pulse SA\n").append(server)
    append("\n#PulseSA #SouthAfrica #Mzansi")
}

fun isInstalled(ctx: Context, pkg: String): Boolean = try {
    ctx.packageManager.getPackageInfo(pkg, 0); true
} catch (_: Exception) { false }

/**
 * Shares a problem as its 1080×1350 image + caption. If [target] has a package and that app
 * is installed it opens straight in that app; otherwise Android's share sheet opens.
 */
suspend fun shareCard(ctx: Context, card: FeedCard, caption: String, target: Target?) {
    val file = try { Api(ctx).cardImage(card.id) } catch (e: IOException) {
        Toast.makeText(ctx, e.message ?: "Couldn't prepare the image", Toast.LENGTH_LONG).show(); return
    }
    val uri: Uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", file)
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "image/png"
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_TEXT, caption)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    val pkg = target?.pkg
    try {
        if (pkg != null && isInstalled(ctx, pkg)) {
            ctx.startActivity(send.setPackage(pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } else {
            if (pkg != null) Toast.makeText(ctx, "${target.name} isn't installed, pick another app", Toast.LENGTH_SHORT).show()
            ctx.startActivity(Intent.createChooser(send, "Share to").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    } catch (_: ActivityNotFoundException) {
        ctx.startActivity(Intent.createChooser(send, "Share to").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}

fun openLink(ctx: Context, url: String?) {
    if (url.isNullOrBlank()) return
    try { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    catch (_: ActivityNotFoundException) { Toast.makeText(ctx, "No app can open that link", Toast.LENGTH_SHORT).show() }
}
