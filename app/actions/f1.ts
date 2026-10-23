"use server";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { requireAuth } from "@/lib/services/auth-server";
import { getF1RaceClassification } from "@/lib/services/jolpica-f1-service";
import { getF1WeekendResults } from "@/lib/services/openf1-service";
import {
  f1RaceRefSchema,
  f1WeekendRefSchema,
  type F1RaceRefData,
  type F1WeekendRefData,
} from "@/schemas/f1";
import type { F1RaceClassification, F1WeekendResults } from "@/types/sports";

/**
 * A race's full classification, fetched when its sheet opens. Signed-in only,
 * though the data is public: the action spends Jolpica's rate limit.
 */
export async function getF1RaceClassificationAction(
  input: F1RaceRefData
): Promise<ActionResult<F1RaceClassification>> {
  return safe("f1", async () => {
    await requireAuth();
    const parsed = f1RaceRefSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid race" };
    }
    const classification = await getF1RaceClassification(parsed.data.season, parsed.data.round);
    if (!classification) {
      return { success: false, error: "The classification isn't available yet" };
    }
    return { success: true, data: classification };
  });
}

/**
 * A weekend's session results — practice, qualifying, sprint, race — read
 * from OpenF1 when a race's sheet opens. Signed-in only, for the same reason.
 */
export async function getF1WeekendResultsAction(
  input: F1WeekendRefData
): Promise<ActionResult<F1WeekendResults>> {
  return safe("f1", async () => {
    await requireAuth();
    const parsed = f1WeekendRefSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid race weekend" };
    }
    const { season, round, from, to } = parsed.data;
    return { success: true, data: await getF1WeekendResults(season, round, from, to) };
  });
}
