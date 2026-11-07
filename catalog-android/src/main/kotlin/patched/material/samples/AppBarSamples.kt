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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.material.AppBarDefaults
import androidx.compose.material.BottomAppBar
import androidx.compose.material.ContentAlpha
import androidx.compose.material.Icon
import androidx.compose.material.IconButton
import androidx.compose.material.LocalContentAlpha
import androidx.compose.material.Text
import androidx.compose.material.TopAppBar
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Menu
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier

@Sampled
@Composable
fun SimpleTopAppBar() {
    // Sample includes local edits: https://github.com/yschimke/compose-ui-samples/blob/main/catalog/patches/0003-connect-interactive-samples.patch
    var likes by remember { mutableStateOf(0) }
    TopAppBar(
        windowInsets = AppBarDefaults.topAppBarWindowInsets,
        title = { Text(if (likes == 0) "Simple TopAppBar" else "Simple TopAppBar ($likes)") },
        navigationIcon = {
            IconButton(onClick = { likes = 0 }) {
                Icon(Icons.Filled.Menu, contentDescription = null)
            }
        },
        actions = {
            // RowScope here, so these icons will be placed horizontally
            IconButton(onClick = { likes++ }) {
                Icon(Icons.Filled.Favorite, contentDescription = "Localized description")
            }
            IconButton(onClick = { likes++ }) {
                Icon(Icons.Filled.Favorite, contentDescription = "Localized description")
            }
        },
    )
}

@Sampled
@Composable
fun SimpleBottomAppBar() {
    // Sample includes local edits: https://github.com/yschimke/compose-ui-samples/blob/main/catalog/patches/0003-connect-interactive-samples.patch
    var count by remember { mutableStateOf(0) }
    BottomAppBar(windowInsets = AppBarDefaults.bottomAppBarWindowInsets) {
        // Leading icons should typically have a high content alpha
        CompositionLocalProvider(LocalContentAlpha provides ContentAlpha.high) {
            IconButton(onClick = { count = 0 }) {
                Icon(Icons.Filled.Menu, contentDescription = "Localized description")
            }
        }
        // The actions should be at the end of the BottomAppBar. They use the default medium
        // content alpha provided by BottomAppBar
        if (count > 0) Text("Likes: $count")
        Spacer(Modifier.weight(1f, true))
        IconButton(onClick = { count++ }) {
            Icon(Icons.Filled.Favorite, contentDescription = "Localized description")
        }
        IconButton(onClick = { count++ }) {
            Icon(Icons.Filled.Favorite, contentDescription = "Localized description")
        }
    }
}
