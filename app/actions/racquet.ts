"use server";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { requireAuth } from "@/lib/services/auth-server";
import { getTennisDraw } from "@/lib/services/espn-tennis-service";
import { getPadelDraw } from "@/lib/services/padel-api-service";
import { racquetDrawSchema, type RacquetDrawData } from "@/schemas/racquet";
import type { RacquetDraw } from "@/types/sports";

/**
 * One padel or tennis tournament's draw, for a view the feed shipped none to.
 *
 * The feed ships only the featured and the current draw; every other one is
 * read here when somebody opens it, through a cache per tournament (a day
 * once it is finished, five minutes while it is played). Signed-in only: it
 * is not anybody's data, but each miss spends a provider's daily budget.
 */
export async function getRacquetDrawAction(
  input: RacquetDrawData
): Promise<ActionResult<RacquetDraw>> {
  return safe("sports", async () => {
    await requireAuth();
    const parsed = racquetDrawSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Tournament not found" };
    const { sport, tournamentId } = parsed.data;
    const draw = sport === "padel" ? await getPadelDraw(tournamentId) : await getTennisDraw(tournamentId);
    if (!draw) return { success: false, error: "The draw could not be loaded" };
    return { success: true, data: draw };
  });
}
