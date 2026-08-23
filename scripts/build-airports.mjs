/**
 * Regenerate lib/travel/data/airports.ts from the upstream dataset.
 *
 *   node scripts/build-airports.mjs
 *
 * Source: https://github.com/mwgg/Airports (MIT).
 */
import { writeFileSync } from "node:fs";

const URL = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";
const res = await fetch(URL);
if (!res.ok) throw new Error(`airports fetch failed: ${res.status}`);
const data = await res.json();

const seen = new Set();
const rows = [];
for (const a of Object.values(data)) {
  if (!a.iata || !/^[A-Z]{3}$/.test(a.iata)) continue;
  if (seen.has(a.iata)) continue; // IATA codes are unique; keep the first
  if (!a.name || !a.country || !/^[A-Z]{2}$/.test(a.country)) continue;
  seen.add(a.iata);
  rows.push([a.iata, a.name.trim(), (a.city || "").trim(), a.country]);
}
rows.sort((x, y) => x[0].localeCompare(y[0]));

const header = [
  "/**",
  " * Airports with an IATA code, as [code, name, city, countryCode] tuples.",
  " *",
  " * Tuples rather than objects: at ~7,900 entries, repeating four keys per row",
  " * roughly doubles the file for nothing. This module is imported dynamically",
  " * so its weight only lands when somebody opens the airport picker.",
  " *",
  " * GENERATED — do not edit. Source: https://github.com/mwgg/Airports (MIT).",
  " * Regenerate with `node scripts/build-airports.mjs`.",
  " */",
  "export type AirportRow = readonly [",
  "  code: string,",
  "  name: string,",
  "  city: string,",
  "  country: string,",
  "];",
  "",
  "export const AIRPORTS: readonly AirportRow[] = ",
].join("\n");

writeFileSync("lib/travel/data/airports.ts", header + JSON.stringify(rows) + " as const;\n");
console.log("airports written:", rows.length);
