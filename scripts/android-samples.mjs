#!/usr/bin/env node
/**
 * Generate the ANDROID lane's `@Preview` wrappers — `catalog-android/.../AndroidSamplePreviews.kt` —
 * from the sources of the `*-samples` artifacts AndroidX publishes to androidx.dev.
 *
 * ## Why the Android lane is artifacts, not vendored sources
 *
 * The desktop lane (`:catalog`) compiles vendored sources pinned to the AndroidX commit whose
 * samples match the Compose Multiplatform release it renders against. The Android lane renders
 * against AndroidX itself, at one pinned SNAPSHOT build — the only way to show a sample whose API
 * merged into androidx-main but has shipped in no release (Modifier.illuminate, aosp/4322706). The
 * samples and the libraries must come from the same commit or they do not compile together, and
 * androidx.dev publishes exactly that pair: every sample tree as an artifact (`ui-samples`,
 * `foundation-samples`, …) of the same build as the libraries. So `:catalog-android` depends on those
 * compiled AARs — which also carry the `R` resources the desktop lane has to quarantine — and this
 * script reads their sources jars only to know what to wrap.
 *
 * ## What it writes
 *
 * One wrapper per renderable sample — the same classification `scripts/samples-previews.mjs` makes —
 * named `<Sample>AndroidPreview`. The suffix is load-bearing: the reusable workflow folds this module
 * in as `extra-module`, whose previews REPLACE same-named functions in the desktop bundle. Distinct
 * names make every Android render an ADDITION, which `scripts/samples-spec.mjs` then attaches to its
 * desktop card as a `platform: android` variant, or publishes as an Android-only card.
 *
 * Unlike the desktop lane, samples that carry `@Preview` upstream are wrapped too (with the
 * annotation's arguments): discovery only scans this module's own classes, never the AARs.
 *
 *     node scripts/android-samples.mjs            # fetch (cached) and regenerate
 *     node scripts/android-samples.mjs --check    # fail if the generated file is stale
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { classifySamples, quarantinedPreviews } from "./samples-previews.mjs";

export const MANIFEST = "catalog/import.json";
export const QUARANTINE = "catalog/quarantine.json";
export const VERSIONS = "gradle/libs.versions.toml";
export const PACKAGE = "ee.schimke.composeuisamples.android";
export const OUT = `catalog-android/src/main/kotlin/${PACKAGE.replace(/\./g, "/")}/AndroidSamplePreviews.kt`;

/** `{ build, version }` of the pinned androidx.dev snapshot, from the version catalog. */
export function snapshotPin(path = VERSIONS) {
  const text = readFileSync(path, "utf8");
  const build = text.match(/^androidxSnapshotBuild\s*=\s*"(\d+)"/m)?.[1];
  const version = text.match(/^androidx-compose-snapshot\s*=\s*"([^"]+)"/m)?.[1];
  if (!build || !version) throw new Error(`${path} must pin androidxSnapshotBuild and androidx-compose-snapshot`);
  return { build, version };
}

const repositoryOf = (build) =>
  `https://androidx.dev/snapshots/builds/${build}/artifacts/repository`;

const curl = (url, out) =>
  execFileSync("curl", ["-fsSL", "--retry", "3", ...(out ? ["-o", out] : []), url], {
    encoding: out ? undefined : "utf8",
    stdio: ["ignore", out ? "ignore" : "pipe", "pipe"],
  });

/**
 * Download and unpack the sources jar of every library's `androidSamples` artifact at the pinned
 * build into ONE tree under [cacheBase] (package directories keep the libraries apart), and return
 * its path. Reuses a complete earlier unpack of the same build.
 */
export function fetchAndroidSources(manifest, pin, cacheBase = join(tmpdir(), "androidx-snapshot-samples")) {
  const dir = join(cacheBase, pin.build);
  const done = join(dir, ".complete");
  if (existsSync(done)) return join(dir, "src");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "jars"), { recursive: true });
  const repo = repositoryOf(pin.build);
  for (const library of manifest.libraries) {
    if (!library.androidSamples) continue;
    const [group, artifact] = library.androidSamples.split(":");
    const base = `${repo}/${group.replace(/\./g, "/")}/${artifact}/${pin.version}`;
    // A snapshot repository names its files by TIMESTAMPED version; the metadata says which.
    const metadata = curl(`${base}/maven-metadata.xml`);
    const stamped = metadata.match(/<value>([^<]+)<\/value>/)?.[1];
    if (!stamped) throw new Error(`no snapshot version for ${library.androidSamples} in build ${pin.build}`);
    const jar = join(dir, "jars", `${artifact}-sources.jar`);
    curl(`${base}/${artifact}-${stamped}-sources.jar`, jar);
    execFileSync("unzip", ["-o", "-q", jar, "*.kt", "-d", join(dir, "src")], { stdio: "ignore" });
  }
  writeFileSync(done, `${pin.build}\n`);
  return join(dir, "src");
}

/** Classify the Android lane's samples, naming each wrapper `<qualifier><fn>AndroidPreview`. */
export function classifyAndroid(dir, skip = quarantinedPreviews(QUARANTINE, "android")) {
  const { wrap, hasPreview, takesArguments, quarantined } = classifySamples(dir, skip);
  const all = [...wrap, ...hasPreview].map((sample) => ({
    ...sample,
    wrapper: `${sample.qualifier}${sample.fn}AndroidPreview`,
  }));
  all.sort((a, b) => a.wrapper.localeCompare(b.wrapper));
  return { samples: all, takesArguments, quarantined };
}

export function renderAndroidPreviews(samples, pin) {
  const header = `// GENERATED by scripts/android-samples.mjs — do not edit.
//
// The ANDROID lane's \`@Preview\` wrappers: one per renderable \`@Sampled\` composable in the
// \`*-samples\` artifacts of androidx.dev snapshot build ${pin.build} (${pin.version}), which this module
// depends on. Named \`…AndroidPreview\` so the catalog fold ADDS each render beside its desktop card
// instead of replacing it.

package ${PACKAGE}

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
`;
  const body = samples
    .map(({ fn, package: pkg, wrapper, previewArgs }) => {
      const annotation = previewArgs ? `@Preview(${previewArgs})` : "@Preview";
      return `\n${annotation}\n@Composable\nfun ${wrapper}() = ${pkg}.${fn}()\n`;
    })
    .join("");
  return header + body;
}

function main(argv) {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const pin = snapshotPin();
  const dir = fetchAndroidSources(manifest, pin);
  const skip = quarantinedPreviews(QUARANTINE, "android");
  const { samples, takesArguments, quarantined } = classifyAndroid(dir, skip);
  const source = renderAndroidPreviews(samples, pin);

  if (argv.includes("--check")) {
    if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== source) {
      console.error(`${OUT} is stale: regenerate it with \`node scripts/android-samples.mjs\`.`);
      process.exit(1);
    }
    console.log(`${OUT} is current (${samples.length} wrapper(s), snapshot build ${pin.build}).`);
    return;
  }
  mkdirSync(join(OUT, ".."), { recursive: true });
  const tmp = `${OUT}.tmp`;
  writeFileSync(tmp, source);
  renameSync(tmp, OUT);
  console.log(`${OUT}: ${samples.length} wrapper(s) from snapshot build ${pin.build}.`);
  for (const fn of quarantined) console.log(`  quarantined: ${fn} — ${skip.get(fn)}`);
  if (takesArguments.length > 0) {
    console.log(`  ${takesArguments.length} @Sampled function(s) take arguments and are not wrapped.`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("android-samples.mjs")) main(process.argv.slice(2));
