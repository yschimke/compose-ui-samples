// `:catalog` — the AndroidX Compose samples, every `androidx.compose` sample tree except material3,
// rendered as ONE catalog: the `compose-ui-samples` system on preview.coo.ee.
//
// This is yschimke/m3-catalog's `:ui-samples-catalog` (foundation only) widened to the rest of the
// Compose stack — ui, graphics, text, unit, animation, runtime and Material (2) — with the same
// renderer, the same importer and the same vendoring contract. material3 stays in m3-catalog, where
// its samples are paired with the kit cells they are call sites for.
//
// ── A Compose Multiplatform (desktop) module ──────────────────────────────────────────────────
//
// No AGP: the compose-preview plugin then routes it to the Desktop (Skiko) renderer, and
// preview.coo.ee can live re-render the published bundle. The cost is that Android-only samples —
// an Activity, a `Context`, `android.*` — cannot compile here; those are listed, with their errors,
// in `catalog/quarantine.json`.
//
// Everything under `src/main/kotlin/upstream/` is VENDORED: upstream's bytes, in upstream's own
// packages, fetched by `scripts/import-samples.mjs` from the commit pinned in
// `catalog/import.json`.
// It is never edited in place and never formatted — a fix is a patch in `catalog/patches/` with a
// stated reason.
//
// ── The wrappers are the point ────────────────────────────────────────────────────────────────
//
// Below material3, upstream almost never annotates a sample with `@Preview`, so
// `scripts/samples-previews.mjs` generates one per zero-argument `@Sampled` composable, into this
// module's own package and never into the vendored tree.
plugins {
  alias(libs.plugins.kotlin.jvm)
  alias(libs.plugins.compose.multiplatform)
  alias(libs.plugins.compose.compiler)
  id("ee.schimke.composeai.preview")
}

kotlin {
  jvmToolchain(21)

  // AndroidX compiles its own samples with these opt-ins: a sample demonstrating an experimental
  // API cannot avoid naming it. Opting in here rather than patching the files with `@file:OptIn`
  // keeps the vendored tree byte-identical.
  compilerOptions {
    optIn.addAll(
      "androidx.compose.animation.ExperimentalAnimationApi",
      "androidx.compose.animation.ExperimentalSharedTransitionApi",
      "androidx.compose.animation.core.ExperimentalAnimationSpecApi",
      "androidx.compose.animation.core.ExperimentalTransitionApi",
      "androidx.compose.animation.graphics.ExperimentalAnimationGraphicsApi",
      "androidx.compose.foundation.ExperimentalFoundationApi",
      "androidx.compose.foundation.layout.ExperimentalLayoutApi",
      "androidx.compose.foundation.layout.ExperimentalFlexBoxApi",
      "androidx.compose.foundation.layout.ExperimentalGridApi",
      "androidx.compose.foundation.text.InternalFoundationTextApi",
      "androidx.compose.material.ExperimentalMaterialApi",
      "androidx.compose.material3.ExperimentalMaterial3Api",
      "androidx.compose.runtime.ExperimentalComposeApi",
      "androidx.compose.ui.ExperimentalComposeUiApi",
      "androidx.compose.ui.graphics.ExperimentalGraphicsApi",
      "androidx.compose.ui.text.ExperimentalTextApi",
      "kotlin.ExperimentalStdlibApi",
    )
  }
}

dependencies {
  implementation(platform(libs.composeai.contracts.bom))
  implementation(platform(libs.composeai.daemon.bom))
  implementation(compose.desktop.currentOs)
  // The libraries whose samples are vendored, one per `catalog/import.json` entry.
  implementation(libs.compose.animation)
  implementation(libs.compose.animation.core)
  implementation(libs.compose.animation.graphics)
  implementation(libs.compose.foundation)
  implementation(libs.compose.foundation.layout)
  implementation(libs.compose.material)
  implementation(libs.compose.runtime)
  implementation(libs.compose.runtime.saveable)
  implementation(libs.compose.ui)
  implementation(libs.compose.ui.graphics)
  implementation(libs.compose.ui.text)
  implementation(libs.compose.ui.unit)
  implementation(libs.compose.ui.tooling)
  // `androidx.compose.ui.tooling.preview.Preview` — the FQN discovery scans for, and what the
  // generated wrappers carry.
  implementation(libs.compose.ui.tooling.preview)
  // A foundation sample still has to SHOW something, and upstream reaches for Material 3's `Text`
  // and `Button` to do it. A dependency, not a sample source.
  implementation(libs.compose.material3)
  implementation(libs.compose.material.icons.extended)
  implementation(libs.androidx.annotation)
  implementation(libs.jb.lifecycle.viewmodel.compose)
  implementation(libs.kotlinx.coroutines.swing)
}

// Two exclusions from formatting. `upstream/` is upstream's bytes: ktfmt would rewrite it into a
// permanent diff against every future import. `SamplePreviews.kt` is the generator's output and its
// canonical form is whatever `scripts/samples-previews.mjs` emits; `--check` regenerates and diffs
// it, so a formatter rewriting it would put the two checks in conflict.
tasks.withType<com.ncorti.ktfmt.gradle.tasks.KtfmtBaseTask>().configureEach {
  exclude {
    val path = it.file.absolutePath.replace('\\', '/')
    path.contains("/src/main/kotlin/upstream/") ||
      path.endsWith("/src/main/kotlin/ee/schimke/composeuisamples/SamplePreviews.kt")
  }
}
