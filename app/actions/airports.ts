"use server";

import { searchAirports } from "@/lib/travel/airports";
import type { Airport } from "@/lib/travel/airports";

/**
 * Airport lookup, run on the server.
 *
 * The dataset is ~7,900 airports — 115 KB gzipped if shipped to the browser,
 * which is a lot to spend on one form field. Searching here keeps the client
 * at zero bytes and keeps every airport findable, rather than bundling a
 * "top 200" list that fails the moment somebody flies somewhere small.
 *
 * No auth gate: this is a public reference table, not anybody's data.
 */
export async function searchAirportsAction(query: string): Promise<Airport[]> {
  return searchAirports(query, 8);
}
