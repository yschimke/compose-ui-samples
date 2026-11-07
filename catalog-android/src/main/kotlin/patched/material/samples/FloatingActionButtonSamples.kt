/*
 * Copyright 2019 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package ee.schimke.composeuisamples.android.patched.material.samples

import androidx.annotation.Sampled
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.ExtendedFloatingActionButton
import androidx.compose.material.FloatingActionButton
import androidx.compose.material.Icon
import androidx.compose.material.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

@Sampled
@Composable
fun SimpleFab() {
    // Sample includes local edits: https://github.com/yschimke/compose-ui-samples/blob/main/catalog/patches/0003-connect-interactive-samples.patch
    var liked by remember { mutableStateOf(false) }
    FloatingActionButton(onClick = { liked = !liked }) {
        Icon(
            Icons.Filled.Favorite,
            contentDescription = "Localized description",
            tint = if (liked) Color.Red else Color.Unspecified,
        )
    }
}

@Sampled
@Composable
fun SimpleExtendedFabNoIcon() {
    // Sample includes local edits: https://github.com/yschimke/compose-ui-samples/blob/main/catalog/patches/0005-missing-sampled-annotations.patch
    var clicked by remember { mutableStateOf(false) }
    ExtendedFloatingActionButton(
        text = { Text(if (clicked) "CLICKED" else "EXTENDED") },
        onClick = { clicked = !clicked },
    )
}

@Sampled
@Composable
fun SimpleExtendedFabWithIcon() {
    // Sample includes local edits: https://github.com/yschimke/compose-ui-samples/blob/main/catalog/patches/0003-connect-interactive-samples.patch
    var count by remember { mutableStateOf(0) }
    ExtendedFloatingActionButton(
        icon = { Icon(Icons.Filled.Favorite, contentDescription = null) },
        text = { Text(if (count == 0) "ADD TO BASKET" else "IN BASKET ($count)") },
        onClick = { count++ },
    )
}

@Sampled
@Composable
fun FluidExtendedFab() {
    // Sample includes local edits: https://github.com/yschimke/compose-ui-samples/blob/main/catalog/patches/0003-connect-interactive-samples.patch
    var count by remember { mutableStateOf(0) }
    ExtendedFloatingActionButton(
        icon = { Icon(Icons.Filled.Favorite, contentDescription = null) },
        text = { Text(if (count == 0) "FLUID FAB" else "FLUID FAB ($count)") },
        onClick = { count++ },
        modifier = Modifier.fillMaxWidth(),
    )
}
