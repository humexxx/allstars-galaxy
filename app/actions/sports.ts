"use server";

import { refresh, revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import { setSportCompetition, setSportFavorite } from "@/lib/services/sports-service";
import {
  setSportCompetitionSchema,
  setSportFavoriteSchema,
  type SetSportCompetitionData,
  type SetSportFavoriteData,
} from "@/schemas/sports";

const SPORTS_PATH = "/portal/entertainment/sports";
const DASHBOARD_PATH = "/portal";

export async function setSportFavoriteAction(
  input: SetSportFavoriteData
): Promise<ActionResult> {
  return safe("sports", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = setSportFavoriteSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    await setSportFavorite(
      ctx.effectiveUserId,
      parsed.data.sportId,
      parsed.data.isFavorite
    );
    await logImpersonatedMutation({
      action: parsed.data.isFavorite ? "sportFavorite.add" : "sportFavorite.remove",
      entityTable: "user_sports_preferences",
      metadata: { sportId: parsed.data.sportId },
    });
    revalidatePath(SPORTS_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { success: true };
  });
}

/**
 * Sets the championship a favourite sport's dashboard card shows; null hands
 * the card back its own pick. Only the dashboard shows it: the sports page
 * takes its league from the URL.
 */
export async function setSportCompetitionAction(
  input: SetSportCompetitionData
): Promise<ActionResult> {
  return safe("sports", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = setSportCompetitionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Unknown championship" };
    }
    const { sportId, competition } = parsed.data;
    const row = await setSportCompetition(ctx.effectiveUserId, sportId, competition);
    if (!row) {
      return { success: false, error: "Add this sport to your favorites first" };
    }
    await logImpersonatedMutation({
      action: "sportFavorite.competition",
      entityTable: "user_sports_preferences",
      entityId: row.id,
      metadata: { sportId, competition },
    });
    // refresh(), not revalidatePath: the choice is an uncached row, so a
    // re-render is all the dashboard needs. Expiring /portal would also expire
    // every provider feed it reads (the path is one of their soft tags), for
    // every user, and a reader flipping leagues would spend football-data's
    // ten calls a minute and get the sample tables.
    refresh();
    return { success: true };
  });
}
