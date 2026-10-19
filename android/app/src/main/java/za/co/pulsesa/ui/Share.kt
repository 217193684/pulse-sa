package za.co.pulsesa.ui

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.core.content.FileProvider
import za.co.pulsesa.data.Api
import za.co.pulsesa.data.FeedCard
import java.io.IOException

/** A place to share to. `pkg` = the app's package; null = Android's own "share to any app" sheet. */
data class Target(val name: String, val mark: String, val pkg: String?)

val TARGETS = listOf(
    Target("TikTok", "Tt", "com.zhiliaoapp.musically"),
    Target("Instagram", "Ig", "com.instagram.android"),
    Target("X", "X", "com.twitter.android"),
    Target("Facebook", "f", "com.facebook.katana"),
    Target("WhatsApp", "Wa", "com.whatsapp"),
    Target("LinkedIn", "in", "com.linkedin.android"),
    Target("More", "…", null),
)

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
