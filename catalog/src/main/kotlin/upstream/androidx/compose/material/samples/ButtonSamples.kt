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

package androidx.compose.material.samples

import androidx.annotation.Sampled
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.material.Button
import androidx.compose.material.ButtonDefaults
import androidx.compose.material.Icon
import androidx.compose.material.OutlinedButton
import androidx.compose.material.Text
import androidx.compose.material.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier

@Sampled
@Composable
fun ButtonSample() {
    // Sample includes local edits: https://github.com/yschimke/compose-ui-samples/blob/main/catalog/patches/0003-connect-interactive-samples.patch
    var count by remember { mutableStateOf(0) }
    Button(onClick = { count++ }) { Text(if (count == 0) "Button" else "Button ($count)") }
}

@Sampled
@Composable
fun OutlinedButtonSample() {
    // Sample includes local edits: https://github.com/yschimke/compose-ui-samples/blob/main/catalog/patches/0003-connect-interactive-samples.patch
    var count by remember { mutableStateOf(0) }
    OutlinedButton(onClick = { count++ }) {
        Text(if (count == 0) "Outlined Button" else "Outlined Button ($count)")
    }
}

@Sampled
@Composable
fun TextButtonSample() {
    // Sample includes local edits: https://github.com/yschimke/compose-ui-samples/blob/main/catalog/patches/0003-connect-interactive-samples.patch
    var count by remember { mutableStateOf(0) }
    TextButton(onClick = { count++ }) {
        Text(if (count == 0) "Text Button" else "Text Button ($count)")
    }
}

@Sampled
@Composable
fun ButtonWithIconSample() {
    // Sample includes local edits: https://github.com/yschimke/compose-ui-samples/blob/main/catalog/patches/0003-connect-interactive-samples.patch
    var liked by remember { mutableStateOf(false) }
    Button(onClick = { liked = !liked }) {
        Icon(
            Icons.Filled.Favorite,
            contentDescription = null,
            modifier = Modifier.size(ButtonDefaults.IconSize),
        )
        Spacer(Modifier.size(ButtonDefaults.IconSpacing))
        Text(if (liked) "Liked" else "Like")
    }
}
