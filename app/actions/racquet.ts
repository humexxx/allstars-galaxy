"use server";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { requireAuth } from "@/lib/services/auth-server";
import { getRacquetDraw } from "@/lib/services/racquet-draw-service";
import { racquetDrawSchema, type RacquetDrawData } from "@/schemas/racquet";
import type { RacquetDraw } from "@/types/sports";

/**
 * The hub's featured padel or tennis draw, when the feed could not ship it; a
 * tournament's page reads its own on the server.
 *
 * Read through a cache per tournament (a day once it is finished, five
 * minutes while it is played). Signed-in only: it is not anybody's data, but
 * each miss spends a provider's daily budget.
 */
export async function getRacquetDrawAction(
  input: RacquetDrawData
): Promise<ActionResult<RacquetDraw>> {
  return safe("sports", async () => {
    await requireAuth();
    const parsed = racquetDrawSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Tournament not found" };
    const { sport, tournamentId } = parsed.data;
    const draw = await getRacquetDraw(sport, tournamentId);
    if (!draw) return { success: false, error: "The draw could not be loaded" };
    return { success: true, data: draw };
  });
}
