package za.co.pulsesa.data

import android.content.Context
import za.co.pulsesa.BuildConfig

/** Small settings kept on the phone. */
class Prefs(context: Context) {
    private val p = context.getSharedPreferences("pulse", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = (p.getString("server", null)?.takeIf { it.isNotBlank() } ?: BuildConfig.API_URL).trimEnd('/')
        set(v) = p.edit().putString("server", v.trim().trimEnd('/')).apply()

    var dailyPost: Boolean
        get() = p.getBoolean("dailyPost", false)
        set(v) = p.edit().putBoolean("dailyPost", v).apply()

    /** Hour of day (0–23) for the daily "post today's top 3" reminder. */
    var postHour: Int
        get() = p.getInt("postHour", 18)
        set(v) = p.edit().putInt("postHour", v).apply()

    var platforms: Set<String>
        get() = p.getStringSet("platforms", null) ?: setOf("TikTok", "Instagram", "X", "Facebook")
        set(v) = p.edit().putStringSet("platforms", v).apply()

    var saved: Set<String>
        get() = p.getStringSet("saved", null) ?: emptySet()
        set(v) = p.edit().putStringSet("saved", v).apply()

    /** The owner key (the server's ADMIN_TOKEN): lets this phone ask for explainers and send them to YouTube. */
    var ownerKey: String
        get() = p.getString("ownerKey", "") ?: ""
        set(v) = p.edit().putString("ownerKey", v.trim()).apply()
}
