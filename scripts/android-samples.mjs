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
 * ## Patched files
 *
 * A compiled artifact cannot be patched, but some samples need the same fix the desktop lane makes
 * in `catalog/patches/` — five draw from the unseeded `kotlin.random.Random` and would render a
 * different picture on every run. So every file those patches touch is ALSO compiled here: copied
 * from the snapshot's sources jar, patched with the very same patch files, and moved into the
 * `ee.schimke.composeuisamples.android.patched.*` package (`androidx.compose.` swapped for that
 * prefix) so it cannot collide with the class in the AAR. The wrappers for the samples in those
 * files call the patched copy; every other wrapper calls the artifact. A patch that stops applying
 * to the snapshot fails here, exactly as it fails the desktop import.
 *
 *     node scripts/android-samples.mjs            # fetch (cached) and regenerate
 *     node scripts/android-samples.mjs --check    # fail if the generated file is stale
 */

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import { classifySamples, quarantinedPreviews } from "./samples-previews.mjs";
import { applyPatches } from "./import-samples.mjs";

export const MANIFEST = "catalog/import.json";
export const QUARANTINE = "catalog/quarantine.json";
export const VERSIONS = "gradle/libs.versions.toml";
export const PACKAGE = "ee.schimke.composeuisamples.android";
export const OUT = `catalog-android/src/main/kotlin/${PACKAGE.replace(/\./g, "/")}/AndroidSamplePreviews.kt`;
export const PATCHES = "catalog/patches";
export const PATCHED_OUT = "catalog-android/src/main/kotlin/patched";
export const PATCHED_PREFIX = `${PACKAGE}.patched.`;

/** The vendored-tree paths the patches in [dir] touch (`+++ b/<path>` lines). */
export function patchedPaths(dir = PATCHES) {
  if (!existsSync(dir)) return [];
  const paths = new Set();
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".patch"))) {
    for (const m of readFileSync(join(dir, name), "utf8").matchAll(/^\+\+\+ b\/(\S+)$/gm)) {
      paths.add(m[1]);
    }
  }
  return [...paths].sort();
}

/** `androidx.compose.foundation.samples` -> `ee.schimke.composeuisamples.android.patched.foundation.samples`. */
export function patchedPackage(pkg) {
  return pkg.replace(/^androidx\.compose\./, PATCHED_PREFIX);
}

/**
 * Write the patched copies into [out]: copy each patched path from [src], apply every patch, then
 * rewrite each file's package (and nothing else — same-package references between the copies keep
 * resolving because they all move together). Returns the patched paths.
 */
export function writePatched(src, out = PATCHED_OUT, dir = PATCHES) {
  const paths = patchedPaths(dir);
  rmSync(out, { recursive: true, force: true });
  if (paths.length === 0) return paths;
  const work = mkdtempSync(join(tmpdir(), "android-patched-"));
  try {
    for (const path of paths) {
      mkdirSync(dirname(join(work, path)), { recursive: true });
      copyFileSync(join(src, path), join(work, path));
    }
    applyPatches(work, dir);
    for (const path of paths) {
      let text = readFileSync(join(work, path), "utf8");
      const pkg = text.match(/^package\s+([\w.]+)/m)?.[1];
      if (pkg) {
        const relocated = patchedPackage(pkg);
        text = text
          .replace(/^package\s+[\w.]+/m, `package ${relocated}`)
          .replaceAll(`import ${pkg}.`, `import ${relocated}.`)
          .replace(/^import androidx\.compose\.ui\.tooling\.preview\.Preview\n/gm, "")
          .replace(/@Preview(?:\([^)]*\))?\s*/g, "");
      }
      const target = join(out, path.replace(/^androidx\/compose\//, ""));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return paths;
}

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
export function classifyAndroid(
  dir,
  skip = quarantinedPreviews(QUARANTINE, "android"),
  patched = new Set(),
) {
  const patchList = patchedPaths();
  const canPatch =
    patched.size > 0 &&
    patchList.length > 0 &&
    patchList.every((p) => existsSync(join(dir, p)));
  const work = canPatch ? mkdtempSync(join(tmpdir(), "android-classify-")) : null;
  let classified;
  try {
    if (work) {
      cpSync(dir, work, { recursive: true });
      applyPatches(work, PATCHES);
      classified = classifySamples(work, skip);
    } else {
      classified = classifySamples(dir, skip);
    }
  } finally {
    if (work) rmSync(work, { recursive: true, force: true });
  }
  const baseDir = work ?? dir;
  const { wrap, hasPreview, takesArguments, quarantined } = classified;
  const all = [...wrap, ...hasPreview].map((sample) => {
    const rel = relative(resolve(baseDir), resolve(sample.file)).replace(/\\/g, "/");
    return {
      ...sample,
      file: join(dir, rel),
      wrapper: `${sample.qualifier}${sample.fn}AndroidPreview`,
      // A sample in a patched file is called through its patched copy, never the artifact.
      ...(patched.has(rel) ? { callPackage: patchedPackage(sample.package) } : {}),
    };
  });
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
    .map(({ fn, package: pkg, callPackage, wrapper, previewArgs }) => {
      const annotation = previewArgs ? `@Preview(${previewArgs})` : "@Preview";
      return `\n${annotation}\n@Composable\nfun ${wrapper}() = ${callPackage ?? pkg}.${fn}()\n`;
    })
    .join("");
  return header + body;
}

function main(argv) {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const pin = snapshotPin();
  const dir = fetchAndroidSources(manifest, pin);
  const skip = quarantinedPreviews(QUARANTINE, "android");
  const check = argv.includes("--check");
  const patchedOut = check ? mkdtempSync(join(tmpdir(), "android-patched-check-")) : PATCHED_OUT;
  const patched = new Set(writePatched(dir, patchedOut));
  const { samples, takesArguments, quarantined } = classifyAndroid(dir, skip, patched);
  const source = renderAndroidPreviews(samples, pin);

  if (check) {
    let stale = !existsSync(OUT) || readFileSync(OUT, "utf8") !== source;
    try {
      execFileSync("diff", ["-r", PATCHED_OUT, patchedOut], { stdio: "ignore" });
    } catch {
      stale = true;
    }
    rmSync(patchedOut, { recursive: true, force: true });
    if (stale) {
      console.error(
        `${OUT} or ${PATCHED_OUT} is stale: regenerate with \`node scripts/android-samples.mjs\`.`,
      );
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
  console.log(`  ${patched.size} patched file(s) compiled into ${PATCHED_OUT}.`);
  for (const fn of quarantined) console.log(`  quarantined: ${fn} — ${skip.get(fn)}`);
  if (takesArguments.length > 0) {
    console.log(`  ${takesArguments.length} @Sampled function(s) take arguments and are not wrapped.`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("android-samples.mjs")) main(process.argv.slice(2));
