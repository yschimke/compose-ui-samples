# Compose UI Samples

The AndroidX **Jetpack Compose samples** — the `@Sampled` functions that the Compose API reference
links to — rendered on **desktop and Android** and published as one browsable catalog.

- **Browse it:** `preview.coo.ee/compose-ui-samples/`
- **Import it:** the generated bundle is on the `design-artifacts/compose-ui-samples` branch of
  [`yschimke/compose-ui-samples-out`](https://github.com/yschimke/compose-ui-samples-out). Every
  generated branch goes there, so a clone of this repository holds source only.

## What's in it

Every `androidx.compose` sample tree that has a Compose Multiplatform desktop artifact, **except
material3**. Each library is a section of the catalog:

| Section | AndroidX library |
| --- | --- |
| Foundation | `compose.foundation:foundation` |
| Layout | `compose.foundation:foundation-layout` |
| UI | `compose.ui:ui` |
| Graphics | `compose.ui:ui-graphics` |
| Text | `compose.ui:ui-text` |
| Unit | `compose.ui:ui-unit` |
| Animation / Animation Core / Animation Graphics | `compose.animation:*` |
| Runtime / Runtime Saveable | `compose.runtime:*` |
| Material | `compose.material:material` (Material 2) |

The material3 samples are published by [`yschimke/m3-catalog`](https://github.com/yschimke/m3-catalog)
as `m3-samples`, paired with the Material 3 Design Kit cells they demonstrate. That repository is
also where this setup comes from: same importer, same wrapper generator, same reusable publishing
workflow, widened from foundation to the rest of Compose.

Left out on purpose: Android-only trees with no desktop artifact (`remote`, `runtime-livedata`,
`runtime-rxjava*`, `ui-viewbinding`, `ui-text-google-fonts`, `material-navigation`), the `ui-test*`
trees (test rules, nothing to render) and `ui-tooling-preview` (empty wrapper demos).

## Two render lanes, one catalog

| Lane | Module | Renders | Against |
| --- | --- | --- | --- |
| Desktop | `:catalog` | vendored sources at the commit matching Compose Multiplatform | Compose Multiplatform 1.12 (Skiko) |
| Android | `:catalog-android` | the `*-samples` artifacts of one androidx.dev snapshot build | AndroidX at that snapshot (Robolectric) |

A sample both lanes can draw is **one card**, with its Android render as a variant tagged
`platform: android`. A sample only Android can draw is an **Android-only card**: Android APIs
(Activities, Views, insets), Android `R` resources, and APIs that have merged into androidx-main but
aren't in any release yet, such as `Modifier.illuminate` (`LightingSamples.kt`, aosp/4322706).

The Android lane compiles no sample sources. AndroidX publishes every sample tree as an artifact of
the same snapshot build as the libraries, so the samples and the APIs they call always match. The
build is pinned (`androidxSnapshotBuild` in `gradle/libs.versions.toml`). androidx.dev prunes old
builds, so if the Android lane stops resolving, move the pin forward.

The Design Artifacts workflow renders `:catalog` as the primary bundle and folds `:catalog-android`
in as compose-ai-tools' `extra-module`. That fold joins by function name, and a shared name would
*replace* the desktop render, so Android wrappers are always named `…AndroidPreview`.

## How it works

```
catalog/import.json        the upstream pin: androidx/androidx at one commit SHA, one entry per library
catalog/quarantine.json    files that cannot compile on desktop, and samples that cannot render, with reasons
catalog/patches/           small fixes to upstream's bytes, each with its reason in its header
catalog/src/main/kotlin/upstream/   VENDORED — upstream's bytes; never edit, never format
catalog/src/main/kotlin/ee/schimke/composeuisamples/SamplePreviews.kt   GENERATED desktop wrappers
catalog-android/src/main/kotlin/.../AndroidSamplePreviews.kt              GENERATED Android wrappers
catalog/catalog.spec.json  GENERATED inventory: one section per library, one group per file, both lanes
```

1. `node scripts/import-samples.mjs` vendors the sample trees from the pinned commit with a blobless
   sparse clone (~15 MB, no token), skips quarantined files and applies the patches.
2. `node scripts/samples-previews.mjs` writes a `@Preview` wrapper for every zero-argument
   `@Sampled` composable. Below material3, upstream almost never previews its own samples.
3. `node scripts/android-samples.mjs` downloads the snapshot's `*-samples` sources jars from
   androidx.dev and writes an `…AndroidPreview` wrapper for every renderable sample.
4. `node scripts/samples-spec.mjs` writes the catalog inventory from both lanes.
5. `.github/workflows/design-artifacts.yml` renders both lanes and publishes the bundle to
   `compose-ui-samples-out` through compose-ai-tools' reusable `design-artifacts-reusable.yml`, on
   every relevant push to `main` and weekly. It needs the `ARTIFACTS_TOKEN` secret (Contents
   read/write on `compose-ui-samples-out`).

Each generator has a `--check` mode, and CI runs all four, so nothing generated can drift from its
source.

### Changing the corpus

- **Bump upstream:** move `ref` in `catalog/import.json` (with Compose Multiplatform in
  `gradle/libs.versions.toml`), re-run the three scripts, then
  `./gradlew :catalog:compileKotlin :catalog:composePreviewRender`. A **VERSION SKEW** quarantine
  entry that no longer fails should be deleted.
- **A file stops compiling:** prefer a patch in `catalog/patches/` if the fix is small. Quarantine
  takes the whole file out, including samples that work.
- **A sample compiles but throws when rendered:** add it to `previews` in `catalog/quarantine.json`.
  That withholds only its wrapper. Add `"platforms": ["android"]` or `["desktop"]` if it fails on
  one lane only.
- **Move the Android snapshot:** change `androidxSnapshotBuild` (and `androidx-compose-snapshot` if
  the version line moved), then re-run `android-samples.mjs` and `samples-spec.mjs`.

## Verifying a change

```sh
node --test scripts/*.test.mjs
node scripts/import-samples.mjs --check
node scripts/samples-previews.mjs --check
node scripts/android-samples.mjs --check
node scripts/samples-spec.mjs --check
./gradlew :catalog:assemble :catalog:composePreviewDiscover ktfmtCheck
./gradlew :catalog-android:assembleDebug :catalog-android:composePreviewDiscover
./gradlew :catalog:composePreviewRender           # desktop renders -> catalog/build/compose-previews/renders
./gradlew :catalog-android:composePreviewRender   # Android renders (Robolectric), ~3-5 minutes
```

## License

Apache 2.0. The vendored samples are AOSP code under the same license; `PROVENANCE.json` beside
them records the exact upstream commit.
