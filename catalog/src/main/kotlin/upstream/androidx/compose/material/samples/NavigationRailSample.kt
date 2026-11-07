/*
 * Copyright 2021 The Android Open Source Project
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

package androidx.compose.material.samples

import androidx.annotation.Sampled
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material.Icon
import androidx.compose.material.NavigationRail
import androidx.compose.material.NavigationRailDefaults
import androidx.compose.material.NavigationRailItem
import androidx.compose.material.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Sampled
@Composable
fun NavigationRailSample() {
    // Sample includes local edits: https://github.com/yschimke/compose-ui-samples/blob/main/catalog/patches/0005-missing-sampled-annotations.patch
    var selectedItem by remember { mutableStateOf(0) }
    val items = listOf("Home", "Search", "Settings")
    val icons = listOf(Icons.Filled.Home, Icons.Filled.Search, Icons.Filled.Settings)
    NavigationRail(modifier = Modifier.height(300.dp), windowInsets = NavigationRailDefaults.windowInsets) {
        items.forEachIndexed { index, item ->
            NavigationRailItem(
                icon = { Icon(icons[index], contentDescription = item) },
                label = { Text(item) },
                selected = selectedItem == index,
                onClick = { selectedItem = index },
            )
        }
    }
}

@Sampled
@Composable
fun NavigationRailWithOnlySelectedLabelsSample() {
    // Sample includes local edits: https://github.com/yschimke/compose-ui-samples/blob/main/catalog/patches/0005-missing-sampled-annotations.patch
    var selectedItem by remember { mutableStateOf(0) }
    val items = listOf("Home", "Search", "Settings")
    val icons = listOf(Icons.Filled.Home, Icons.Filled.Search, Icons.Filled.Settings)
    NavigationRail(Modifier.height(300.dp)) {
        items.forEachIndexed { index, item ->
            NavigationRailItem(
                icon = { Icon(icons[index], contentDescription = item) },
                label = { Text(item) },
                selected = selectedItem == index,
                onClick = { selectedItem = index },
                alwaysShowLabel = false,
            )
        }
    }
}

@Sampled
@Composable
fun CompactNavigationRailSample() {
    // Sample includes local edits: https://github.com/yschimke/compose-ui-samples/blob/main/catalog/patches/0005-missing-sampled-annotations.patch
    var selectedItem by remember { mutableStateOf(0) }
    val items = listOf("Home", "Search", "Settings")
    val icons = listOf(Icons.Filled.Home, Icons.Filled.Search, Icons.Filled.Settings)
    NavigationRail(Modifier.height(300.dp)) {
        items.forEachIndexed { index, item ->
            NavigationRailItem(
                icon = { Icon(icons[index], contentDescription = item) },
                selected = selectedItem == index,
                onClick = { selectedItem = index },
            )
        }
    }
}

@Sampled
@Composable
fun NavigationRailBottomAlignSample() {
    // Sample includes local edits: https://github.com/yschimke/compose-ui-samples/blob/main/catalog/patches/0005-missing-sampled-annotations.patch
    var selectedItem by remember { mutableStateOf(0) }
    val items = listOf("Home", "Search", "Settings")
    val icons = listOf(Icons.Filled.Home, Icons.Filled.Search, Icons.Filled.Settings)

    NavigationRail(Modifier.height(300.dp)) {
        // A Spacer that pushes the NavigationRail items to the bottom of the NavigationRail.
        Spacer(Modifier.weight(1f))
        items.forEachIndexed { index, item ->
            NavigationRailItem(
                icon = { Icon(icons[index], contentDescription = item) },
                label = { Text(item) },
                selected = selectedItem == index,
                onClick = { selectedItem = index },
                alwaysShowLabel = false,
            )
        }
    }
}
