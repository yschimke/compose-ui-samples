#!/usr/bin/env node
/**
 * Generate `catalog/catalog.spec.json` — the `compose-ui-samples` inventory — from the vendored
 * AndroidX sources.
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

/** One group per file (per section), one component per rendered sample. */
export function buildGroups(manifest, dir = VENDORED, skip = quarantinedPreviews()) {
  const sections = sectionsOf(manifest);
  const { wrap, hasPreview } = classifySamples(dir, skip);
  const byKey = new Map();
  const add = (sample, preview, caption) => {
    const section = sectionOf(sample.file, sections, dir);
    const api = apiName(sample.file);
    const key = `${section}\u0000${api}`;
    if (!byKey.has(key)) byKey.set(key, { section, api, components: [] });
    byKey.get(key).components.push({ fn: sample.fn, preview, caption });
  };
  for (const sample of wrap) {
    add(sample, sample.wrapper, `\`${sample.fn}\` — rendered by a generated \`@Preview\` wrapper.`);
  }
  for (const sample of hasPreview) {
    // Upstream previewed this one itself, so the sample function IS the preview.
    add(sample, sample.fn, `\`${sample.fn}\` — the sample carries its own \`@Preview\` upstream.`);
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
          .map(({ fn, preview, caption }) => ({ componentId: `${name}/${fn}`, preview, caption }))
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
      "GENERATED by scripts/samples-spec.mjs from the vendored sources, catalog/import.json and " +
      "the wrapper classification — do not edit. The inventory is generated rather than annotated " +
      "because the sources are upstream's bytes, re-fetched byte-identically on every import. One " +
      "section per library, one group per source file, one component per rendered sample. No " +
      "`compareWith`: nothing in this repository reproduces a design kit of these APIs.",
    system: "compose-ui-samples",
    title: "Compose UI Samples",
    library: [
      ...new Set(manifest.libraries.map((l) => l.composeMultiplatformCoordinates.replace(/-desktop$/, ""))),
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
  const groups = buildGroups(manifest);
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
