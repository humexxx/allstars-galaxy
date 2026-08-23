import { AIRPORTS } from "./data/airports";

export type Airport = {
  code: string;
  name: string;
  city: string;
  country: string;
  /** 🇨🇷 — derived, never stored. */
  flag: string;
};

/**
 * A country's flag from its ISO-3166-1 alpha-2 code.
 *
 * Regional indicator symbols: 'C' + 'R' becomes 🇨🇷. Computed rather than
 * bundled as 250 emoji, and it degrades to an empty string for anything that
 * is not two letters instead of rendering mojibake.
 */
export function countryFlag(cc: string): string {
  if (!/^[A-Za-z]{2}$/.test(cc)) return "";
  const base = 0x1f1e6 - "A".charCodeAt(0);
  return String.fromCodePoint(
    ...cc.toUpperCase().split("").map((c) => base + c.charCodeAt(0))
  );
}

function toAirport(row: (typeof AIRPORTS)[number]): Airport {
  const [code, name, city, country] = row;
  return { code, name, city, country, flag: countryFlag(country) };
}

/**
 * Rank matters more than filtering here: typing "SJO" must put San José first,
 * not bury it under every airport whose name happens to contain those letters.
 * Exact code wins, then code prefix, then city, then anything else.
 */
function score(row: (typeof AIRPORTS)[number], q: string): number {
  const [code, name, city] = row;
  const lowerCode = code.toLowerCase();
  if (lowerCode === q) return 0;
  if (lowerCode.startsWith(q)) return 1;

  const lowerCity = city.toLowerCase();
  if (lowerCity.startsWith(q)) return 2;

  const lowerName = name.toLowerCase();
  if (lowerName.startsWith(q)) return 3;
  if (lowerCity.includes(q)) return 4;
  if (lowerName.includes(q)) return 5;
  return -1;
}

/** Search by code, city or name. Empty query returns nothing, not everything. */
export function searchAirports(query: string, limit = 8): Airport[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const hits: { row: (typeof AIRPORTS)[number]; rank: number }[] = [];
  for (const row of AIRPORTS) {
    const rank = score(row, q);
    if (rank >= 0) hits.push({ row, rank });
    // A three-letter code can only match one airport exactly, so once the
    // best possible rank is full there is nothing better left to find.
    if (hits.length > 400) break;
  }

  hits.sort((a, b) => a.rank - b.rank || a.row[0].localeCompare(b.row[0]));
  return hits.slice(0, limit).map((h) => toAirport(h.row));
}

/** Look up one code exactly, for showing a saved value with its flag. */
export function findAirport(code: string | null | undefined): Airport | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  const row = AIRPORTS.find((r) => r[0] === upper);
  return row ? toAirport(row) : null;
}
