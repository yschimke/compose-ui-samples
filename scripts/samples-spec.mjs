#!/usr/bin/env node
/**
 * Generate `catalog/catalog.spec.json` — the `compose-ui-samples` inventory — from BOTH render
 * lanes: the vendored sources the desktop lane (`:catalog`) compiles, and the snapshot `*-samples`
 * sources the Android lane (`:catalog-android`) renders (see `scripts/android-samples.mjs`).
 *
 * ## One card per sample, whichever lanes can draw it
 *
 * A sample is keyed by its package and function name, so the same upstream sample on both lanes is
 * ONE component:
 *
 *  - on both: the desktop render is the card, and the Android render is a variant tagged
 *    `props: { platform: "android" }` — the two side by side, never one replacing the other;
 *  - Android only (an Android API, an `R` resource, or an API newer than any Compose Multiplatform
 *    release): the Android render is the card;
 *  - desktop only (removed upstream since the desktop pin, or quarantined on Android): the desktop
 *    render is the card.
 *
 * The Android renders reach the catalog through the reusable workflow's `extra-module`, which joins
 * them to this spec by function name — which is why the Android wrappers are named
 * `…AndroidPreview` and never collide with a desktop one.
 *
 * Ported from yschimke/m3-catalog's `scripts/ui-samples-spec.mjs`, which does the same for the
 * foundation corpus alone. The one addition is a SECTION per library: this catalog spans foundation,
 * layout, ui, graphics, text, animation, runtime and Material, and a reader looking for
 * `AnimatedVisibility` should not have to scroll past every `LazyColumn` sample to find it. The
 * section is the library's `section` in `catalog/import.json`, matched by the package directory the
 * sample was vendored into.
 *
 * ## Why the inventory is generated
 *
 * A catalog declares its inventory either with `@CatalogComponent` beside the `@Preview`, or with
 * `groups` in the spec. The annotation route is closed: the sources are upstream's bytes, re-fetched
 * byte-identically on every import, so an annotation written into one would not survive the next
 * `scripts/import-samples.mjs` run. That leaves `groups`, generated and committed, with a
 * regenerate-and-diff `--check`.
 *
 * It is a projection of the wrapper generator's classification rather than a second scan: a sample
 * that gains a wrapper gains a card, and one that loses it loses the card.
 *
 * ## The shape it produces
 *
 * One **group per source file**, named for the API the file demonstrates (`ColumnSample.kt` ->
 * `Column`), under its library's section. One **component per rendered sample**: each sample is its
 * own call site, so nothing folds as a variant. A group name that two libraries both produce
 * (`animation` and `animation-core` each have a `TransitionSamples.kt`) is qualified with the
 * section, so component ids stay unique.
 *
 *     node scripts/samples-spec.mjs            # regenerate
 *     node scripts/samples-spec.mjs --check    # fail if the committed spec is stale
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";

import { VENDORED, classifySamples, quarantinedPreviews } from "./samples-previews.mjs";
import { packageDirOf } from "./import-samples.mjs";
import { classifyAndroid, fetchAndroidSources, snapshotPin } from "./android-samples.mjs";

export const SPEC = "catalog/catalog.spec.json";
export const MANIFEST = "catalog/import.json";

/**
 * The API a sample file demonstrates: its name without the `Sample`/`Samples` suffix.
 * `ColumnSample.kt` -> `Column`, `LazyGridSamples.kt` -> `LazyGrid`.
 */
export function apiName(file) {
  return basename(file, ".kt").replace(/Samples?$/, "");
}

/** `[{ dir, section }]` from the manifest, longest package directory first. */
export function sectionsOf(manifest) {
  return manifest.libraries
    .flatMap((library) =>
      library.paths.map((path) => ({ dir: packageDirOf(path), section: library.section })),
    )
    .sort((a, b) => b.dir.length - a.dir.length);
}

/**
 * The section a vendored file belongs to. Longest match first, so a file under
 * `androidx/compose/animation/core/samples` is not claimed by `androidx/compose/animation`.
 */
export function sectionOf(file, sections, dir = VENDORED) {
  const rel = relative(resolve(dir), resolve(file)).replace(/\\/g, "/");
  const hit = sections.find((s) => rel.startsWith(`${s.dir}/`));
  if (!hit) throw new Error(`${rel} is under no library in ${MANIFEST}`);
  return hit.section;
}

/**
 * One group per file (per section), one component per sample, merging the two lanes.
 *
 * @param lanes `{ desktopDir, desktopSkip, androidDir, androidSkip, androidLabel }` — `androidDir`
 *   may be omitted for a desktop-only spec; `androidLabel` names what the Android lane renders
 *   against, for the captions.
 */
export function buildGroups(manifest, lanes = {}) {
  const {
    desktopDir = VENDORED,
    desktopSkip = quarantinedPreviews(undefined, "desktop"),
    androidDir = null,
    androidSkip = quarantinedPreviews(undefined, "android"),
    androidLabel = "AndroidX",
  } = lanes;
  const sections = sectionsOf(manifest);
  const key = (sample) => `${sample.package}.${sample.fn}`;

  const samples = new Map();
  const { wrap, hasPreview } = classifySamples(desktopDir, desktopSkip);
  for (const sample of wrap) {
    samples.set(key(sample), { sample, dir: desktopDir, desktop: sample.wrapper, upstream: false });
  }
  for (const sample of hasPreview) {
    // Upstream previewed this one itself, so on desktop the sample function IS the preview.
    samples.set(key(sample), { sample, dir: desktopDir, desktop: sample.fn, upstream: true });
  }
  if (androidDir) {
    for (const sample of classifyAndroid(androidDir, androidSkip).samples) {
      const entry = samples.get(key(sample));
      if (entry) entry.android = sample.wrapper;
      else samples.set(key(sample), { sample, dir: androidDir, android: sample.wrapper });
    }
  }

  const byKey = new Map();
  for (const entry of samples.values()) {
    const { sample, dir } = entry;
    const section = sectionOf(sample.file, sections, dir);
    const api = apiName(sample.file);
    const groupKey = `${section}\u0000${api}`;
    if (!byKey.has(groupKey)) byKey.set(groupKey, { section, api, components: [] });
    const fn = `\`${sample.fn}\``;
    let component;
    if (entry.desktop && entry.android) {
      component = {
        preview: entry.desktop,
        caption: `${fn} — desktop and Android.`,
        variants: [
          {
            preview: entry.android,
            props: { platform: "android" },
            caption: `${fn} on Android (${androidLabel}).`,
          },
        ],
      };
    } else if (entry.android) {
      component = {
        preview: entry.android,
        caption: `${fn} — Android only (${androidLabel}).`,
      };
    } else {
      component = {
        preview: entry.desktop,
        caption: entry.upstream
          ? `${fn} — desktop only; the sample carries its own \`@Preview\` upstream.`
          : `${fn} — desktop only.`,
      };
    }
    byKey.get(groupKey).components.push({ fn: sample.fn, ...component });
  }

  // An API name produced by more than one section is qualified with the section, so a group name
  // — and the component ids built from it — never repeats across the sheet.
  const sectionsPerApi = new Map();
  for (const { api, section } of byKey.values()) {
    sectionsPerApi.set(api, (sectionsPerApi.get(api) ?? new Set()).add(section));
  }
  const order = [...new Set(manifest.libraries.map((l) => l.section))];
  return [...byKey.values()]
    .map(({ section, api, components }) => {
      const name = sectionsPerApi.get(api).size > 1 ? `${api} (${section})` : api;
      return {
        name,
        section,
        components: components
          .map(({ fn, ...rest }) => ({ componentId: `${name}/${fn}`, ...rest }))
          .sort((a, b) => a.componentId.localeCompare(b.componentId)),
      };
    })
    // Sections in manifest order, groups by name within a section: the sheet's display order.
    .sort(
      (a, b) =>
        order.indexOf(a.section) - order.indexOf(b.section) || a.name.localeCompare(b.name),
    );
}

export function buildSpec(manifest, groups) {
  return {
    $schema:
      "https://raw.githubusercontent.com/yschimke/compose-ai-tools/main/scripts/design-artifacts/catalog.spec.schema.json",
    $comment:
      "GENERATED by scripts/samples-spec.mjs from both render lanes — the vendored sources " +
      "(:catalog, desktop) and the AndroidX snapshot sample artifacts (:catalog-android, Android) — " +
      "do not edit. One section per library, one group per source file, one component per sample: " +
      "a sample on both lanes carries its Android render as a `platform: android` variant, and a " +
      "sample only one lane can draw is a card on that lane alone. No `compareWith`: nothing in this " +
      "repository reproduces a design kit of these APIs.",
    system: "compose-ui-samples",
    title: "Compose UI Samples",
    library: [
      ...new Set(
        manifest.libraries.flatMap((l) => [
          l.composeMultiplatformCoordinates.replace(/-desktop$/, ""),
          l.artifactCoordinates,
        ]),
      ),
    ],
    module: ":catalog",
    // A foundation sample says nothing about theming, but the Material surfaces upstream draws its
    // text and buttons on do, and a sheet published in one mode only cannot be read in the other.
    modes: ["light", "dark"],
    display: { role: "samples" },
    groups,
  };
}

function main(argv) {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const pin = snapshotPin();
  const groups = buildGroups(manifest, {
    androidDir: fetchAndroidSources(manifest, pin),
    androidLabel: `AndroidX snapshot build ${pin.build}`,
  });
  const json = `${JSON.stringify(buildSpec(manifest, groups), null, 2)}\n`;
  const components = groups.reduce((n, g) => n + g.components.length, 0);

  if (argv.includes("--check")) {
    if (readFileSync(SPEC, "utf8") !== json) {
      console.error(`${SPEC} is stale: regenerate it with \`node scripts/samples-spec.mjs\`.`);
      process.exit(1);
    }
    console.log(`${SPEC} is current (${components} component(s) in ${groups.length} group(s)).`);
    return;
  }

  writeFileSync(SPEC, json);
  console.log(`${SPEC}: ${components} component(s) in ${groups.length} group(s).`);
}

if (process.argv[1] && process.argv[1].endsWith("samples-spec.mjs")) main(process.argv.slice(2));
