# Repository instructions for AI agents

Read [README.md](README.md) first. This repository is the non-material3 sibling of
[yschimke/m3-catalog](https://github.com/yschimke/m3-catalog)'s samples modules; when in doubt, that
repository's `AGENTS.md` and `docs/design/ANDROIDX_SAMPLES.md` are the longer explanation.

- **`catalog/src/main/kotlin/upstream/` is upstream's bytes.** Never edit it and never format it.
  A fix is a patch in `catalog/patches/` with its reason in its header; a file that cannot compile
  is a `catalog/quarantine.json` entry with the compiler's error count and the reason.
- **Generated files are regenerated, never hand-edited:** `SamplePreviews.kt`,
  `AndroidSamplePreviews.kt` and `catalog/catalog.spec.json`. CI runs every generator's `--check`.
- **Two lanes, one catalog.** `:catalog` is desktop (vendored sources, Compose Multiplatform);
  `:catalog-android` is Android (the `*-samples` artifacts of one pinned androidx.dev snapshot,
  Robolectric), folded in by function name. Android wrappers must keep the `…AndroidPreview` suffix:
  a name shared with the desktop lane makes the fold REPLACE the desktop render.
- **The inventory is generated `groups` in the spec, not `@CatalogComponent` annotations**, because
  an annotation written into a vendored file would not survive the next import.
- **Render before merging anything that moves Compose Multiplatform, Skiko or the upstream pin.**
  `assemble` stays green while a renderer break publishes an empty sheet.
- Run Gradle through `build-brief` (`build-brief ./gradlew …`).
- `main` takes changes through PRs. Conventional commit subjects (`feat:`, `fix:`, `chore:`); the
  PR title is the squash commit subject. Never attribute a commit to an AI agent.
