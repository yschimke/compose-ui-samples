# Patches for the vendored samples

The vendored tree under `../src/main/kotlin/upstream/` is upstream's bytes, re-fetched
byte-identically on every import. A fix is a patch here — never an edit in place — with its reason
in its own header, so the next import re-applies it and a patch that stops applying **fails** the
import rather than silently reverting its fix.

Prefer a patch to a quarantine entry wherever the fix is small enough to state: quarantine is per
file, so it takes out every sample in the file, including the ones that render perfectly well.
Patch paths are relative to the vendored tree (`androidx/compose/...`), applied with `git apply -p1`.

| Patch | Why |
| --- | --- |
| `0001-seed-random-samples.patch` | five foundation samples drew from the unseeded `kotlin.random.Random`, so they rendered differently every run and the preview-diff bot flagged them on every PR. Carried over from yschimke/m3-catalog. |
| `0002-sample-backgrounds.patch` | wraps samples that draw dark text, icons, strokes, or controls on a transparent root in a light `Surface` or white background container so they are legible against dark preview backdrops. |
| `0003-connect-interactive-samples.patch` | connects samples whose buttons, chips, FABs, icon buttons, menus, or app-bar actions had no-op `onClick` lambdas so clicking updates local state visibly. |
| `0004-sample-sizes.patch` | fixes samples with unset or `1x1` sizes (uninvoked local composables, zero-size boxes), bare root sibling composables overlapping at `(0, 0)`, or `fillMaxSize()`/`fillMaxHeight()` blowing small demos up to a full-screen canvas. |
