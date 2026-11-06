import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MANIFEST,
  SPEC,
  apiName,
  buildGroups,
  buildSpec,
  exemptSemantics,
} from "./samples-spec.mjs";
import { fetchAndroidSources, snapshotPin } from "./android-samples.mjs";

const FOUNDATION = "androidx/compose/foundation/samples";
const ANIMATION = "androidx/compose/animation/samples";
const ANIMATION_CORE = "androidx/compose/animation/core/samples";

const lib = (section, dir) => ({
  section,
  paths: [`compose/x/samples/src/main/java/${dir}`],
  artifactCoordinates: "androidx.compose.x:x",
  composeMultiplatformCoordinates: "org.jetbrains.compose.x:x-desktop",
});

const MANIFEST_FIXTURE = {
  libraries: [
    lib("Foundation", FOUNDATION),
    lib("Animation", ANIMATION),
    lib("Animation Core", ANIMATION_CORE),
  ],
};

/** A throwaway vendored tree: `<root>/<name>` for each entry, nested paths allowed. */
function vendored(files) {
  const root = mkdtempSync(join(tmpdir(), "samples-spec-test-"));
  for (const [name, text] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, text);
  }
  return root;
}

const SAMPLE = (fn, pkg = "androidx.compose.foundation.samples", annotations = "@Sampled\n@Composable") =>
  `package ${pkg}\n\n${annotations}\nfun ${fn}() {}\n`;

test("the group is the API the file demonstrates, either spelling of the suffix", () => {
  assert.equal(apiName("a/b/ColumnSample.kt"), "Column");
  assert.equal(apiName("a/b/LazyGridSamples.kt"), "LazyGrid");
});

test("one group per file, one component per rendered sample, under its library's section", () => {
  const root = vendored({
    [`${FOUNDATION}/ColumnSample.kt`]: SAMPLE("ColumnSample") + SAMPLE("ColumnEqualWeightSample"),
    [`${FOUNDATION}/BorderSample.kt`]: SAMPLE("BorderSample"),
    [`${ANIMATION}/CrossfadeSamples.kt`]: SAMPLE("CrossfadeSample", "androidx.compose.animation.samples"),
  });
  try {
    const groups = buildGroups(MANIFEST_FIXTURE, { desktopDir: root, desktopSkip: new Map() });
    assert.deepEqual(
      groups.map((g) => [g.section, g.name]),
      [
        ["Foundation", "Border"],
        ["Foundation", "Column"],
        ["Animation", "Crossfade"],
      ],
    );
    assert.deepEqual(
      groups[1].components.map((c) => c.componentId),
      ["Column/ColumnEqualWeightSample", "Column/ColumnSample"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a group name two sections share is qualified, and the longest package wins the section", () => {
  // `animation` and `animation-core` both ship a `TransitionSamples.kt`, and `animation/core` sits
  // under `animation` on disk.
  const root = vendored({
    [`${ANIMATION}/TransitionSamples.kt`]: SAMPLE("A", "androidx.compose.animation.samples"),
    [`${ANIMATION_CORE}/TransitionSamples.kt`]: SAMPLE("B", "androidx.compose.animation.core.samples"),
  });
  try {
    const groups = buildGroups(MANIFEST_FIXTURE, { desktopDir: root, desktopSkip: new Map() });
    assert.deepEqual(
      groups.map((g) => [g.section, g.name, g.components[0].componentId]),
      [
        ["Animation", "Transition (Animation)", "Transition (Animation)/A"],
        ["Animation Core", "Transition (Animation Core)", "Transition (Animation Core)/B"],
      ],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a wrapped sample names its generated wrapper, an annotated one names itself", () => {
  const root = vendored({
    [`${FOUNDATION}/ColumnSample.kt`]: SAMPLE("ColumnSample"),
    [`${FOUNDATION}/CanvasSample.kt`]: SAMPLE(
      "CanvasSample",
      undefined,
      "@Sampled\n@Preview\n@Composable",
    ),
  });
  try {
    const groups = buildGroups(MANIFEST_FIXTURE, { desktopDir: root, desktopSkip: new Map() });
    assert.equal(groups.find((g) => g.name === "Canvas").components[0].preview, "CanvasSample");
    assert.equal(groups.find((g) => g.name === "Column").components[0].preview, "ColumnSamplePreview");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a file under no manifest library fails rather than publishing unsectioned", () => {
  const root = vendored({ "elsewhere/XSample.kt": SAMPLE("XSample") });
  try {
    assert.throws(() => buildGroups(MANIFEST_FIXTURE, { desktopDir: root, desktopSkip: new Map() }), /under no library/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the spec names this system and declares no compareWith", () => {
  const spec = buildSpec(MANIFEST_FIXTURE, []);
  assert.equal(spec.compareWith, undefined);
  assert.equal(spec.system, "compose-ui-samples");
  assert.equal(spec.module, ":catalog");
  // Both lanes' artifacts: Compose Multiplatform for desktop, AndroidX for Android.
  assert.deepEqual(spec.library, ["org.jetbrains.compose.x:x", "androidx.compose.x:x"]);
});

test("a sample on both lanes is one card with an Android variant; one lane alone is its own card", () => {
  const desktop = vendored({
    [`${FOUNDATION}/ColumnSample.kt`]: SAMPLE("ColumnSample") + SAMPLE("GoneUpstreamSample"),
  });
  const android = vendored({
    [`${FOUNDATION}/ColumnSample.kt`]: SAMPLE("ColumnSample"),
    [`${FOUNDATION}/LightingSamples.kt`]: SAMPLE("IlluminateSample"),
  });
  try {
    const groups = buildGroups(MANIFEST_FIXTURE, {
      desktopDir: desktop,
      desktopSkip: new Map(),
      androidDir: android,
      androidSkip: new Map(),
      androidLabel: "snap",
    });
    const byId = Object.fromEntries(
      groups.flatMap((g) => g.components).map((c) => [c.componentId, c]),
    );
    assert.equal(byId["Column/ColumnSample"].preview, "ColumnSamplePreview");
    assert.deepEqual(byId["Column/ColumnSample"].variants, [
      {
        preview: "ColumnSampleAndroidPreview",
        props: { platform: "android" },
        caption: "`ColumnSample` on Android (snap).",
      },
    ]);
    assert.equal(byId["Column/GoneUpstreamSample"].preview, "GoneUpstreamSamplePreview");
    assert.equal(byId["Column/GoneUpstreamSample"].variants, undefined);
    assert.equal(byId["Lighting/IlluminateSample"].preview, "IlluminateSampleAndroidPreview");
    assert.match(byId["Lighting/IlluminateSample"].caption, /Android only/);
  } finally {
    rmSync(desktop, { recursive: true, force: true });
    rmSync(android, { recursive: true, force: true });
  }
});

test("the committed spec matches what the generator produces", () => {
  // Needs the Android lane's sources: fetched from androidx.dev at the pinned build (cached).
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const pin = snapshotPin();
  const groups = buildGroups(manifest, {
    androidDir: fetchAndroidSources(manifest, pin),
    androidLabel: `AndroidX snapshot build ${pin.build}`,
  });
  const committed = readFileSync(SPEC, "utf8");
  assert.equal(
    committed,
    `${JSON.stringify(buildSpec(manifest, groups, exemptSemantics()), null, 2)}\n`,
  );
});

test("semantics exemptions land in completeness, and only when there are any", () => {
  assert.equal(buildSpec(MANIFEST_FIXTURE, []).completeness, undefined);
  assert.deepEqual(buildSpec(MANIFEST_FIXTURE, [], ["A/B"]).completeness.exemptSemantics, ["A/B"]);
});
