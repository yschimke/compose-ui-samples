# Compose UI Samples

The AndroidX **Jetpack Compose samples** — the `@Sampled` functions that the Compose API reference
links to — vendored from upstream, rendered, and published as one browsable catalog.

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

## How it works

```
catalog/import.json        the upstream pin: androidx/androidx at one commit SHA, one entry per library
catalog/quarantine.json    files that cannot compile on desktop, and samples that cannot render, with reasons
catalog/patches/           small fixes to upstream's bytes, each with its reason in its header
catalog/src/main/kotlin/upstream/   VENDORED — upstream's bytes; never edit, never format
catalog/src/main/kotlin/ee/schimke/composeuisamples/SamplePreviews.kt   GENERATED @Preview wrappers
catalog/catalog.spec.json  GENERATED inventory: one section per library, one group per file
```

1. `node scripts/import-samples.mjs` vendors the sample trees from the pinned commit with a blobless
   sparse clone (~15 MB, no token), skips quarantined files and applies the patches.
2. `node scripts/samples-previews.mjs` writes a `@Preview` wrapper for every zero-argument
   `@Sampled` composable. Below material3, upstream almost never previews its own samples.
3. `node scripts/samples-spec.mjs` writes the catalog inventory from the same classification.
4. `.github/workflows/design-artifacts.yml` renders `:catalog` on the Compose Multiplatform desktop
   renderer and publishes the bundle to `compose-ui-samples-out` through compose-ai-tools'
   reusable `design-artifacts-reusable.yml`, on every relevant push to `main` and weekly.

Each generator has a `--check` mode, and CI runs all three, so nothing generated can drift from its
source.

### Changing the corpus

- **Bump upstream:** move `ref` in `catalog/import.json` (with Compose Multiplatform in
  `gradle/libs.versions.toml`), re-run the three scripts, then
  `./gradlew :catalog:compileKotlin :catalog:composePreviewRender`. A **VERSION SKEW** quarantine
  entry that no longer fails should be deleted.
- **A file stops compiling:** prefer a patch in `catalog/patches/` if the fix is small. Quarantine
  takes the whole file out, including samples that work.
- **A sample compiles but throws when rendered:** add it to `previews` in `catalog/quarantine.json`.
  That withholds only its wrapper.

## Verifying a change

```sh
node --test scripts/*.test.mjs
node scripts/import-samples.mjs --check
node scripts/samples-previews.mjs --check
node scripts/samples-spec.mjs --check
./gradlew :catalog:assemble :catalog:composePreviewDiscover ktfmtCheck
./gradlew :catalog:composePreviewRender   # renders every preview to catalog/build/compose-previews/renders
```

## License

Apache 2.0. The vendored samples are AOSP code under the same license; `PROVENANCE.json` beside
them records the exact upstream commit.
