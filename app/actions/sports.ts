"use server";

import { revalidatePath } from "next/cache";

import { safe } from "@/lib/actions/safe";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import { setSportFavorite } from "@/lib/services/sports-service";
import {
  setSportFavoriteSchema,
  type SetSportFavoriteInput,
} from "@/schemas/sports";

const SPORTS_PATH = "/portal/entertainment/sports";
const DASHBOARD_PATH = "/portal";

export async function setSportFavoriteAction(input: SetSportFavoriteInput) {
  return safe("sports", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = setSportFavoriteSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid input" };
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
    return { success: true as const };
  });
}
