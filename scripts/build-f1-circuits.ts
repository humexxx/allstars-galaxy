/**
 * Regenerate lib/data/sports/f1-circuits.ts, the track outlines on the F1
 * race cards, from https://github.com/bacinger/f1-circuits (MIT).
 *
 *   pnpm exec tsx scripts/build-f1-circuits.ts
 *
 * Pinned to one commit so a re-run reproduces the file: bump SOURCE_COMMIT to
 * pick up a new or re-traced track. It ends by listing any circuit on
 * Jolpica's current calendar that is still without an outline.
 */
import { writeFileSync } from "node:fs";

import {
  CIRCUIT_VIEWBOX_SIZE,
  outlinePath,
  projectCircuit,
  type LonLat,
} from "@/lib/sports/circuit-outline";

const SOURCE_REPO = "bacinger/f1-circuits";
const SOURCE_COMMIT = "8094e957b8d6aa8b9f4510c93968556cccd30e02";
const RAW = `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_COMMIT}`;
const JOLPICA_CALENDAR = "https://api.jolpi.ca/ergast/f1/current.json";
const OUT = "lib/data/sports/f1-circuits.ts";

/**
 * Jolpica's `circuitId` → the source's track id. The 2026 calendar, plus the
 * three 2025 circuits it dropped (Bahrain, Jeddah, Imola), which the bundled
 * fixture still races at. A circuit new to the calendar needs its line here.
 */
const SOURCE_ID: Record<string, string> = {
  albert_park: "au-1953",
  americas: "us-2012",
  bahrain: "bh-2002",
  baku: "az-2016",
  catalunya: "es-1991",
  hungaroring: "hu-1986",
  imola: "it-1953",
  interlagos: "br-1940",
  jeddah: "sa-2021",
  losail: "qa-2004",
  madring: "es-2026",
  marina_bay: "sg-2008",
  miami: "us-2022",
  monaco: "mc-1929",
  monza: "it-1922",
  red_bull_ring: "at-1969",
  rodriguez: "mx-1962",
  sepang: "my-1999",
  shanghai: "cn-2004",
  silverstone: "gb-1948",
  spa: "be-1925",
  suzuka: "jp-1962",
  vegas: "us-2023",
  villeneuve: "ca-1978",
  yas_marina: "ae-2009",
  zandvoort: "nl-1948",
};

type TrackFeature = {
  properties: { id: string };
  geometry: { type: string; coordinates: LonLat[] };
};

async function download(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res;
}

function render(outlines: Array<[string, string]>, license: string): string {
  // Downloaded text going into a comment: a `*/` in it would end the comment.
  const notice = license
    .trim()
    .replaceAll("*/", "*\\/")
    .split("\n")
    .map((line) => ` * ${line}`.trimEnd())
    .join("\n");
  return [
    "/**",
    " * F1 circuit outlines keyed by Jolpica's `circuitId`: one SVG path per track,",
    " * north up, fitted to `F1_CIRCUIT_VIEWBOX` by lib/sports/circuit-outline.ts.",
    " *",
    " * GENERATED — do not edit. Regenerate with",
    " * `pnpm exec tsx scripts/build-f1-circuits.ts`.",
    " *",
    ` * Source: https://github.com/${SOURCE_REPO} at ${SOURCE_COMMIT.slice(0, 7)},`,
    " * the track lines of `f1-circuits.geojson`, under the MIT License:",
    " *",
    notice,
    " */",
    `export const F1_CIRCUIT_VIEWBOX = "0 0 ${CIRCUIT_VIEWBOX_SIZE} ${CIRCUIT_VIEWBOX_SIZE}";`,
    "",
    "export const F1_CIRCUIT_OUTLINES: Readonly<Record<string, string>> = {",
    ...outlines.map(([id, d]) => `  ${id}: "${d}",`),
    "};",
    "",
  ].join("\n");
}

/** Advisory: the file is written either way, and Jolpica being down is not a reason to fail. */
async function reportCalendarGaps(): Promise<void> {
  try {
    const res = await download(JOLPICA_CALENDAR);
    const body = (await res.json()) as {
      MRData: { RaceTable: { season: string; Races: Array<{ Circuit: { circuitId: string } }> } };
    };
    const { season, Races } = body.MRData.RaceTable;
    const missing = Races.map((r) => r.Circuit.circuitId).filter((id) => !Object.hasOwn(SOURCE_ID, id));
    if (missing.length === 0) console.log(`Every circuit on the ${season} calendar has an outline.`);
    else console.warn(`No outline yet for these ${season} circuits: ${missing.join(", ")}`);
  } catch (error) {
    console.warn("Could not check the outlines against Jolpica's calendar:", error);
  }
}

async function main(): Promise<void> {
  const [geojson, license] = await Promise.all([
    download(`${RAW}/f1-circuits.geojson`).then((r) => r.json() as Promise<{ features: TrackFeature[] }>),
    download(`${RAW}/LICENSE.md`).then((r) => r.text()),
  ]);
  const tracks = new Map(geojson.features.map((f) => [f.properties.id, f]));

  const outlines = Object.entries(SOURCE_ID)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([circuitId, sourceId]): [string, string] => {
      const track = tracks.get(sourceId);
      if (track?.geometry.type !== "LineString") {
        throw new Error(`${SOURCE_REPO} has no track line "${sourceId}" for ${circuitId}`);
      }
      return [circuitId, outlinePath(projectCircuit(track.geometry.coordinates))];
    });

  writeFileSync(OUT, render(outlines, license));
  console.log(`Wrote ${outlines.length} outlines to ${OUT}.`);
  await reportCalendarGaps();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
