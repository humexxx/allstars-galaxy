"use server";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { requireAuth } from "@/lib/services/auth-server";
import { getLolSplit } from "@/lib/services/lolesports-service";
import { lolSplitSchema } from "@/schemas/lol";
import type { LolRegion, LolSplit } from "@/types/sports";

/**
 * Another of a league's splits this season, for the view to move to from
 * inside the league: the feed carries only each league's latest. Signed-in
 * only, as the other on-demand reads are.
 */
export async function getLolSplitAction(input: {
  region: LolRegion;
  tournamentId: string;
}): Promise<ActionResult<LolSplit>> {
  return safe("sports", async () => {
    await requireAuth();
    const parsed = lolSplitSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Split not found" };
    const split = await getLolSplit(parsed.data.region, parsed.data.tournamentId);
    if (!split) return { success: false, error: "The split could not be loaded" };
    return { success: true, data: split };
  });
}
