#!/usr/bin/env node
/**
 * Generate a `@Preview` wrapper for every vendored sample that does not carry one upstream.
 *
 * Ported from yschimke/m3-catalog (`scripts/samples-previews.mjs`, itself ported from
 * yschimke/wear-m3-catalog). Below material3, upstream almost never annotates a sample with
 * `@Preview` — foundation ships one on 7 of its 73 sample files, and `ui`, `ui-text` and
 * `animation` none at all — so without wrappers this catalog would publish almost nothing.
 *
 * ## What it generates, and what it refuses to
 *
 * One wrapper per sample, in this repository's own package and its own generated file — never
 * inside the vendored tree, which stays byte-identical to upstream:
 *
 * ```kotlin
 * @Preview @Composable fun ColumnSamplePreview() = androidx.compose.foundation.layout.samples.ColumnSample()
 * ```
 *
 * A sample is wrapped only when it is a **zero-argument `@Composable`**. Anything else is skipped
 * and reported:
 *
 *  - a `@Sampled` function taking parameters is a helper a sample calls, not a call site anyone can
 *    render on its own;
 *  - a sample that already carries a preview annotation is left alone, or discovery would find the
 *    same composable twice and publish it twice;
 *  - a sample named in `catalog/quarantine.json`'s `previews` list compiles but cannot RUN here,
 *    and a wrapper for it would fail the whole render job rather than just itself.
 *
 * The wrapper's name is the sample's name plus `Preview`. A sample name can repeat across upstream's
 * packages — `InfiniteTransitionSample` exists in both `animation` and `animation-core` — and then
 * every one of them is qualified by its library instead (`AnimationCoreInfiniteTransitionSamplePreview`),
 * so neither is silently dropped and neither name depends on which was read first.
 *
 *     node scripts/samples-previews.mjs            # regenerate
 *     node scripts/samples-previews.mjs --check    # fail if the generated file is stale
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const VENDORED = "catalog/src/main/kotlin/upstream";
export const QUARANTINE = "catalog/quarantine.json";
export const PACKAGE = "ee.schimke.composeuisamples";
export const OUT = `catalog/src/main/kotlin/${PACKAGE.replace(/\./g, "/")}/SamplePreviews.kt`;

/** Every `.kt` file under [dir], recursively — the vendored tree keeps upstream's package dirs. */
export function kotlinSources(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...kotlinSources(path));
    else if (entry.name.endsWith(".kt")) out.push(path);
  }
  return out.sort();
}

/**
 * The sample function names the corpus' quarantine declares unrenderable, mapped to their reasons.
 *
 * The per-FILE `samples` list is the importer's unit and is not read here: a file that does not
 * compile never reaches the vendored tree at all. This is the other failure mode — a sample that
 * compiles and then throws at composition, where taking out its whole file would drop the siblings
 * that render perfectly well.
 */
export function quarantinedPreviews(path = QUARANTINE, lane = "desktop") {
  if (!existsSync(path)) return new Map();
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return new Map(
    (parsed.previews ?? [])
      // An entry without `platforms` holds on every lane; with it, only on the lanes it names.
      .filter((entry) => !entry.platforms || entry.platforms.includes(lane))
      .map((entry) => [entry.sample, entry.reason ?? "(no reason given)"]),
  );
}

/**
 * Classify every `@Sampled` function in the vendored tree.
 *
 * A wrapped sample is `{ fn, package }`: the package is read from the file that declares it rather
 * than assumed, because one corpus spans several. Getting that wrong does not fail quietly — an
 * unresolved call fails the module — but reading it is also simply cheaper than maintaining a table.
 *
 * @returns {{wrap: Sample[], hasPreview: Sample[], takesArguments: string[], quarantined: string[]}}
 *   where a `Sample` is `{ fn, package, file }` — `file` is the vendored path, which
 *   `scripts/samples-spec.mjs` groups the published inventory by.
 */
export function classifySamples(dir = VENDORED, skip = quarantinedPreviews()) {
  const wrap = new Map();
  const hasPreview = new Map();
  const takesArguments = [];
  const quarantined = [];
  for (const file of kotlinSources(dir)) {
    const text = readFileSync(file, "utf8");
    const declaredPackage = text.match(/^package\s+([\w.]+)/m)?.[1];
    if (!declaredPackage) continue;
    // Annotations immediately preceding a `fun`, then its parameter list. The compiler's own rule,
    // so a commented-out sample cannot slip in and a KDoc `@sample` cannot be mistaken for one.
    for (const match of text.matchAll(/((?:@\w+(?:\([^)]*\))?\s*)+)fun\s+(\w+)\s*\(([^)]*)\)/g)) {
      const [, annotations, fn, parameters] = match;
      if (!annotations.includes("@Sampled")) continue;
      if (!annotations.includes("@Composable")) continue;
      const key = `${declaredPackage}.${fn}`;
      if (annotations.includes("@Preview")) {
        // The annotation's own arguments (`showBackground = true`), so a lane that has to wrap an
        // upstream-previewed sample anyway can carry them over.
        const previewArgs = annotations.match(/@Preview\(([^)]*)\)/)?.[1]?.trim() ?? "";
        hasPreview.set(key, { fn, package: declaredPackage, file, previewArgs });
        continue;
      }
      if (skip.has(fn)) {
        quarantined.push(fn);
        continue;
      }
      if (parameters.trim() !== "") {
        takesArguments.push(fn);
        continue;
      }
      wrap.set(key, { fn, package: declaredPackage, file });
    }
  }
  // Name each wrapper; qualify every sample whose bare name repeats across packages.
  const counts = new Map();
  for (const sample of [...wrap.values(), ...hasPreview.values()]) {
    counts.set(sample.fn, (counts.get(sample.fn) ?? 0) + 1);
  }
  for (const sample of [...wrap.values(), ...hasPreview.values()]) {
    sample.qualifier = counts.get(sample.fn) > 1 ? libraryQualifier(sample.package) : "";
  }
  for (const sample of wrap.values()) sample.wrapper = `${sample.qualifier}${sample.fn}Preview`;
  const byWrapper = (a, b) => a.wrapper.localeCompare(b.wrapper);
  return {
    wrap: [...wrap.values()].sort(byWrapper),
    hasPreview: [...hasPreview.values()].sort((a, b) => a.fn.localeCompare(b.fn)),
    takesArguments: [...new Set(takesArguments)].sort(),
    quarantined: [...new Set(quarantined)].sort(),
  };
}

/**
 * `androidx.compose.animation.core.samples` -> `AnimationCore`: the library segment of an upstream
 * sample package, PascalCased, for qualifying a wrapper whose sample name repeats across libraries.
 */
export function libraryQualifier(pkg) {
  return pkg
    .replace(/^androidx\.compose\./, "")
    .replace(/\.samples$/, "")
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * The generated Kotlin source for [samples].
 *
 * Fully qualified call sites rather than imports: two of upstream's sample packages declare
 * functions of the same name (`SpacerSample` exists in both foundation trees at other refs), and a
 * generated file that has to resolve an import collision is a generator that has to understand
 * Kotlin. A qualified call never can.
 *
 * No `device =` and no background: a sample is a picture of a call site and measures itself, and
 * pinning one to a screen would frame it in a canvas it does not fill. The Wear generator this is
 * ported from needs a device for its full-screen samples; nothing here fills a phone screen by design.
 */
export function renderPreviews(samples) {
  const header = `// GENERATED by scripts/samples-previews.mjs — do not edit.
//
// A \`@Preview\` wrapper for every vendored AndroidX Compose sample that does not carry one
// upstream. Below material3, upstream almost never previews its samples, so without these the
// catalog would publish almost nothing.
//
// The wrappers live HERE, in this module's own package, and never inside \`upstream/\` — that tree is
// upstream's bytes and is re-fetched byte-identically on every import.

package ${PACKAGE}

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
`;
  const body = samples
    .map(
      ({ fn, package: pkg, wrapper }) =>
        `\n@Preview\n@Composable\nfun ${wrapper}() = ${pkg}.${fn}()\n`,
    )
    .join("");
  return header + body;
}

function main(argv) {
  const skip = quarantinedPreviews();
  const { wrap, hasPreview, takesArguments, quarantined } = classifySamples(VENDORED, skip);
  const source = renderPreviews(wrap);

  if (argv.includes("--check")) {
    if (readFileSync(OUT, "utf8") !== source) {
      console.error(`${OUT} is stale: regenerate it with \`node scripts/samples-previews.mjs\`.`);
      process.exit(1);
    }
    console.log(`${OUT} is current (${wrap.length} wrapper(s)).`);
    return;
  }

  writeFileSync(OUT, source);
  console.log(`${OUT}: ${wrap.length} wrapper(s) generated.`);
  console.log(`  ${hasPreview.length} sample(s) already carry @Preview upstream and are left alone.`);
  for (const fn of quarantined) console.log(`  quarantined: ${fn} — ${skip.get(fn)}`);
  if (takesArguments.length > 0) {
    console.log(
      `  ${takesArguments.length} @Sampled function(s) take arguments and are not renderable on ` +
        `their own: ${takesArguments.slice(0, 6).join(", ")}${takesArguments.length > 6 ? " …" : ""}`,
    );
  }
}

if (process.argv[1] && process.argv[1].endsWith("samples-previews.mjs")) main(process.argv.slice(2));
