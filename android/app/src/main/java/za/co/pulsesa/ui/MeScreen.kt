package za.co.pulsesa.ui

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import za.co.pulsesa.BuildConfig
import za.co.pulsesa.data.Prefs

@Composable
fun MeScreen(onOpen: (String) -> Unit) {
    val ctx = LocalContext.current
    val prefs = remember { Prefs(ctx) }
    var server by remember { mutableStateOf(prefs.serverUrl) }
    var key by remember { mutableStateOf(prefs.ownerKey) }
    val saved = remember { prefs.saved.toList() }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Brand()
        Section("Saved problems") {
            if (saved.isEmpty()) Text("Tap the bookmark on a card to keep it here.", color = Pulse.Muted, fontSize = 13.sp)
            saved.forEach { id ->
                val (cat, place) = id.split("~").let { it.getOrElse(0) { "" } to it.getOrElse(1) { "" } }
                Text(
                    "${cat.replaceFirstChar { it.uppercase() }} · ${if (place == "za") "South Africa" else place.replace('-', ' ').replaceFirstChar { it.uppercase() }}",
                    modifier = Modifier.fillMaxWidth().clickable { onOpen(id) }.padding(vertical = 6.dp),
                )
            }
        }
        Section("Where the data comes from") {
            Text(
                "Public sources only: South African news headlines (News24, TimesLIVE, SABC, EWN, The Citizen, GroundUp, Daily Maverick, IOL), " +
                    "Google Trends for South Africa, Eskom's load-shedding status, and the GDELT news index. Pulse SA shows headlines with links back to " +
                    "the publisher, groups them by problem and place, and compares today with a normal week.",
                color = Pulse.Soft, fontSize = 13.sp, lineHeight = 18.sp,
            )
        }
        Section("Owner key") {
            Text("Lets this phone ask for explainer videos and send them to YouTube. It's the ADMIN_TOKEN password you made in Vercel.",
                color = Pulse.Soft, fontSize = 13.sp, lineHeight = 18.sp)
            OutlinedTextField(value = key, onValueChange = { key = it }, singleLine = true, label = { Text("Owner key") },
                visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
            Button(onClick = {
                prefs.ownerKey = key
                Toast.makeText(ctx, "Owner key saved", Toast.LENGTH_SHORT).show()
            }, colors = ButtonDefaults.buttonColors(containerColor = Pulse.Teal, contentColor = Pulse.Ground)) { Text("Save key") }
        }
        Section("Server") {
            OutlinedTextField(value = server, onValueChange = { server = it }, singleLine = true, label = { Text("Server address") }, modifier = Modifier.fillMaxWidth())
            Button(onClick = {
                prefs.serverUrl = server
                Toast.makeText(ctx, "Saved. Pull down on the feed to refresh.", Toast.LENGTH_SHORT).show()
            }, colors = ButtonDefaults.buttonColors(containerColor = Pulse.Teal, contentColor = Pulse.Ground)) { Text("Save") }
            Text("Version ${BuildConfig.VERSION_NAME}", color = Pulse.Muted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Pulse.Surface).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        content()
    }
}
