"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { logImpersonatedMutation, requireEffectiveContext } from "@/lib/services/impersonation";
import {
  applyTravelChanges,
  TravelChangeError,
  undoTravelChanges,
} from "@/lib/services/travel-assistant-service";
import { canUseTravelAssistant } from "@/lib/travel/assistant/access";
import {
  travelChangeSetSchema,
  travelUndoTokenSchema,
  type TravelChangeSetInput,
} from "@/schemas/travel-assistant";
import type { AppliedTravelChanges } from "@/types/travel-assistant";

const TRAVEL_PATH = "/portal/entertainment/travel-planner";
const UNAVAILABLE = "The travel assistant is not available";

/** Every trip page and the dashboard card: one proposal can touch several trips. */
function revalidateTravel(): void {
  revalidatePath(TRAVEL_PATH, "layout");
  revalidatePath("/portal");
}

/** Applies a proposal the user approved. Re-checked from scratch: the card is not trusted. */
export async function applyTravelChangesAction(
  input: TravelChangeSetInput
): Promise<ActionResult<AppliedTravelChanges>> {
  return safe("travel-assistant", async () => {
    const ctx = await requireEffectiveContext();
    if (!canUseTravelAssistant(ctx)) return { success: false, error: UNAVAILABLE };

    const parsed = travelChangeSetSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    try {
      const applied = await applyTravelChanges(ctx.effectiveUserId, parsed.data);
      await logImpersonatedMutation({
        action: "trip.assistant.apply",
        entityTable: "trips",
        metadata: { summary: parsed.data.summary, lines: applied.lines },
      });
      revalidateTravel();
      return { success: true, data: applied };
    } catch (err) {
      if (err instanceof TravelChangeError) return { success: false, error: err.message };
      throw err;
    }
  });
}

export async function undoTravelChangesAction(token: string): Promise<ActionResult> {
  return safe("travel-assistant", async () => {
    const ctx = await requireEffectiveContext();
    if (!canUseTravelAssistant(ctx)) return { success: false, error: UNAVAILABLE };
    if (!travelUndoTokenSchema.safeParse(token).success) {
      return { success: false, error: "This change can no longer be undone" };
    }

    try {
      await undoTravelChanges(ctx.effectiveUserId, token);
      await logImpersonatedMutation({ action: "trip.assistant.undo", entityTable: "trips" });
      revalidateTravel();
      return { success: true };
    } catch (err) {
      if (err instanceof TravelChangeError) return { success: false, error: err.message };
      throw err;
    }
  });
}
