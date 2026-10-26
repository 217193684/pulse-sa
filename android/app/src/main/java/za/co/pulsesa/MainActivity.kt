package za.co.pulsesa

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Slideshow
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import za.co.pulsesa.data.FeedCard
import za.co.pulsesa.ui.DetailScreen
import za.co.pulsesa.ui.ExplainScreen
import za.co.pulsesa.ui.FeedScreen
import za.co.pulsesa.ui.MapScreen
import za.co.pulsesa.ui.MeScreen
import za.co.pulsesa.ui.PostsScreen
import za.co.pulsesa.ui.Pulse
import za.co.pulsesa.ui.PulseTheme
import za.co.pulsesa.ui.ShareSheet

class MainActivity : ComponentActivity() {
    private val startTab = mutableStateOf("feed")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        intent?.getStringExtra("tab")?.let { startTab.value = it }
        setContent { PulseTheme { App(startTab.value) { startTab.value = it } } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.getStringExtra("tab")?.let { startTab.value = it }
    }
}

private val TABS = listOf(
    Triple("feed", "Feed", Icons.Default.Slideshow),
    Triple("map", "Map", Icons.Default.Map),
    Triple("posts", "Posts", Icons.Default.Send),
    Triple("explain", "Explain", Icons.Default.Lightbulb),
    Triple("me", "Me", Icons.Default.Person),
)

@androidx.compose.runtime.Composable
private fun App(tab: String, setTab: (String) -> Unit) {
    var detail by rememberSaveable { mutableStateOf<String?>(null) }
    var sharing by androidx.compose.runtime.remember { mutableStateOf<FeedCard?>(null) }
    var askTopic by rememberSaveable { mutableStateOf<String?>(null) }
    val explain: (String) -> Unit = { topic -> askTopic = topic; detail = null; setTab("explain") }
    BackHandler(enabled = detail != null) { detail = null }

    Scaffold(
        containerColor = Pulse.Ground,
        bottomBar = {
            NavigationBar(containerColor = Pulse.Ground) {
                TABS.forEach { (id, label, icon) ->
                    NavigationBarItem(
                        selected = tab == id && detail == null,
                        onClick = { detail = null; setTab(id) },
                        icon = { Icon(icon, label) }, label = { Text(label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Pulse.Ground, indicatorColor = Pulse.Teal, selectedTextColor = Pulse.Text,
                            unselectedIconColor = Pulse.Muted, unselectedTextColor = Pulse.Muted,
                        ),
                    )
                }
            }
        },
    ) { pad ->
        Box(Modifier.fillMaxSize().background(Pulse.Ground).padding(pad)) {
            val open: (String) -> Unit = { detail = it }
            val d = detail
            if (d != null) DetailScreen(d, onBack = { detail = null }, onShare = { sharing = it }, onExplain = explain)
            else when (tab) {
                "map" -> MapScreen(open)
                "posts" -> PostsScreen(open, onExplain = explain)
                "explain" -> ExplainScreen(askTopic, onAsked = { askTopic = null })
                "me" -> MeScreen(open)
                else -> FeedScreen(open, onShare = { sharing = it })
            }
        }
    }
    sharing?.let { ShareSheet(it) { sharing = null } }
}
