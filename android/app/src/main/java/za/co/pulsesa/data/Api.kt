package za.co.pulsesa.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.IOException
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/** Talks to the Pulse SA server. All calls run off the main thread and throw IOException on failure. */
class Api(private val context: Context) {
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; explicitNulls = false }

    private val base: String get() = Prefs(context).serverUrl

    private fun get(path: String): String {
        val req = Request.Builder().url(base + path).header("accept", "application/json").build()
        client.newCall(req).execute().use { res ->
            if (!res.isSuccessful) throw IOException("Server said ${res.code}")
            return res.body?.string() ?: throw IOException("Empty answer from server")
        }
    }

    suspend fun feed(): FeedResponse = withContext(Dispatchers.IO) { json.decodeFromString(get("/api/feed")) }

    suspend fun map(category: String): MapResponse =
        withContext(Dispatchers.IO) { json.decodeFromString(get("/api/map?category=" + enc(category))) }

    suspend fun problem(id: String): ProblemDetail =
        withContext(Dispatchers.IO) { json.decodeFromString(get("/api/problems/" + enc(id))) }

    suspend fun top3(): Top3 = withContext(Dispatchers.IO) { json.decodeFromString(get("/api/top3")) }

    /** Downloads a problem's 1080×1350 share image into the app's cache and returns the file. */
    suspend fun cardImage(id: String): File = withContext(Dispatchers.IO) {
        val req = Request.Builder().url("$base/api/card/" + enc(id)).build()
        client.newCall(req).execute().use { res ->
            if (!res.isSuccessful) throw IOException("Couldn't make the share image (${res.code})")
            val dir = File(context.cacheDir, "share").apply { mkdirs() }
            val file = File(dir, "pulse-${id.replace(Regex("[^a-z0-9-]"), "-")}.png")
            res.body?.byteStream()?.use { input -> file.outputStream().use { input.copyTo(it) } }
                ?: throw IOException("Empty image")
            file
        }
    }

    suspend fun clips(): List<Clip> = withContext(Dispatchers.IO) { json.decodeFromString<ClipsResponse>(get("/api/clips")).clips }

    suspend fun postLog(): List<PostLogItem> = withContext(Dispatchers.IO) { json.decodeFromString<PostLog>(get("/api/posts")).log }

    /** Records that a video was sent to a platform, so the app can show it as posted and never nag twice. */
    suspend fun logPost(clipId: String, platform: String) = withContext(Dispatchers.IO) {
        val body = """{"platform":"$platform","status":"shared"}""".toRequestBody("application/json".toMediaType())
        val req = Request.Builder().url("$base/api/clips/" + enc(clipId) + "/posts").post(body).build()
        client.newCall(req).execute().use { if (!it.isSuccessful) throw IOException("Couldn't log the post (${it.code})") }
    }

    /** Downloads a video into the app's cache (kept if already there) and returns the file. */
    suspend fun clipFile(clipId: String): File = withContext(Dispatchers.IO) {
        val dir = File(context.cacheDir, "share").apply { mkdirs() }
        val file = File(dir, "pulse-video-${clipId.replace(Regex("[^a-z0-9-]"), "")}.mp4")
        if (file.length() > 0) return@withContext file
        val req = Request.Builder().url("$base/api/clips/" + enc(clipId) + "/video").build()
        client.newCall(req).execute().use { res ->
            if (!res.isSuccessful) throw IOException("Couldn't download the video (${res.code})")
            val tmp = File(dir, file.name + ".part")
            res.body?.byteStream()?.use { input -> tmp.outputStream().use { input.copyTo(it) } } ?: throw IOException("Empty video")
            tmp.renameTo(file)
        }
        file
    }

    suspend fun explainers(): List<Explainer> = withContext(Dispatchers.IO) { json.decodeFromString<ExplainersResponse>(get("/api/explainers")).explainers }

    /** Owner-only actions send the owner key; the server answers with a plain-language error if something is wrong. */
    private fun ownerPost(path: String, body: String): String {
        val req = Request.Builder().url(base + path).header("x-owner-key", Prefs(context).ownerKey)
            .post(body.toRequestBody("application/json".toMediaType())).build()
        client.newCall(req).execute().use { res ->
            val text = res.body?.string() ?: ""
            if (!res.isSuccessful) {
                val msg = Regex("\"error\"\\s*:\\s*\"([^\"]+)\"").find(text)?.groupValues?.get(1) ?: "Server said ${res.code}"
                throw IOException(msg)
            }
            return text
        }
    }

    /** Asks for a new explainer video about a topic (it takes about 30-60 minutes to make). */
    suspend fun requestExplainer(topic: String) = withContext(Dispatchers.IO) {
        ownerPost("/api/explainers", kotlinx.serialization.json.buildJsonObject { put("topic", kotlinx.serialization.json.JsonPrimitive(topic)) }.toString())
    }

    /** Sends a finished explainer to YouTube with the chosen thumbnail (0-2) and privacy. */
    suspend fun sendExplainer(id: String, thumb: Int, privacy: String) = withContext(Dispatchers.IO) {
        ownerPost("/api/explainers/" + enc(id) + "/send", """{"thumb":$thumb,"privacy":"$privacy"}""")
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8").replace("+", "%20")

    companion object {
        val client: OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }
}
