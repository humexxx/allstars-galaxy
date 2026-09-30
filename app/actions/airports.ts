"use server";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { searchAirports } from "@/lib/travel/airports";
import type { Airport } from "@/lib/travel/airports";
import { airportQuerySchema } from "@/schemas/travel";

/**
 * Airport lookup, run on the server.
 *
 * The dataset is ~7,900 airports — 115 KB gzipped if shipped to the browser,
 * which is a lot to spend on one form field. Searching here keeps the client
 * at zero bytes and keeps every airport findable, rather than bundling a
 * "top 200" list that fails the moment somebody flies somewhere small.
 *
 * No auth gate: this is a public reference table, not anybody's data. It is
 * still a public endpoint, so the query is bounded before it is scanned — a
 * malformed one simply finds nothing.
 */
export async function searchAirportsAction(query: string): Promise<ActionResult<Airport[]>> {
  return safe("airports", async () => {
    const parsed = airportQuerySchema.safeParse(query);
    if (!parsed.success) return { success: true, data: [] };
    return { success: true, data: searchAirports(parsed.data, 8) };
  });
}
