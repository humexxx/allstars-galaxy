"use server";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { requireAuth } from "@/lib/services/auth-server";
import { getF1RaceClassification } from "@/lib/services/jolpica-f1-service";
import { f1RaceRefSchema, type F1RaceRefData } from "@/schemas/f1";
import type { F1RaceClassification } from "@/types/sports";

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
