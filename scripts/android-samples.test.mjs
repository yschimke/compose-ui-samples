import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { classifyAndroid, renderAndroidPreviews, snapshotPin } from "./android-samples.mjs";

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), "android-samples-test-"));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(root, name, ".."), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  return root;
}

const PKG = "androidx.compose.ui.samples";
const SAMPLE = (fn, annotations = "@Sampled\n@Composable") =>
  `package ${PKG}\n\n${annotations}\nfun ${fn}() {}\n`;

test("every renderable sample is wrapped as …AndroidPreview, upstream-previewed ones included", () => {
  // Discovery never scans the sample AARs, so a sample previewed upstream still needs a wrapper
  // here — and the suffix keeps every name clear of the desktop lane's, which the fold would
  // otherwise REPLACE.
  const root = tree({
    "a/LightingSamples.kt": SAMPLE("IlluminateSample"),
    "a/MarqueeSamples.kt": SAMPLE("MarqueeSample", "@Sampled\n@Preview(showBackground = true)\n@Composable"),
  });
  try {
    const { samples } = classifyAndroid(root, new Map());
    assert.deepEqual(
      samples.map((s) => [s.wrapper, s.previewArgs ?? ""]),
      [
        ["IlluminateSampleAndroidPreview", ""],
        ["MarqueeSampleAndroidPreview", "showBackground = true"],
      ],
    );
    const source = renderAndroidPreviews(samples, { build: "1", version: "v" });
    assert.match(source, /@Preview\(showBackground = true\)\n@Composable\nfun MarqueeSampleAndroidPreview\(\) = androidx\.compose\.ui\.samples\.MarqueeSample\(\)/);
    assert.match(source, /\npackage ee\.schimke\.composeuisamples\.android\n/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an Android-lane preview quarantine withholds only that lane's wrapper", () => {
  const root = tree({ "a/MeshSamples.kt": SAMPLE("MeshGradientPainterSample") });
  try {
    const { samples, quarantined } = classifyAndroid(root, new Map([["MeshGradientPainterSample", "x"]]));
    assert.deepEqual([samples, quarantined], [[], ["MeshGradientPainterSample"]]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the snapshot pin is read from the version catalog", () => {
  const dir = mkdtempSync(join(tmpdir(), "pin-"));
  const toml = join(dir, "libs.versions.toml");
  writeFileSync(toml, 'androidxSnapshotBuild = "123"\nandroidx-compose-snapshot = "1.14.0-SNAPSHOT"\n');
  try {
    assert.deepEqual(snapshotPin(toml), { build: "123", version: "1.14.0-SNAPSHOT" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
