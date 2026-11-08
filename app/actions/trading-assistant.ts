"use server";

import { revalidatePath } from "next/cache";

import { canUseAssistant } from "@/lib/ai/assistant/access";
import { safe, type ActionResult } from "@/lib/actions/safe";
import { logImpersonatedMutation, requireEffectiveContext } from "@/lib/services/impersonation";
import { applyTradingChanges, TradingChangeError } from "@/lib/services/trading-assistant-service";
import { getRequestTimeZone } from "@/lib/utils/request-today";
import { tradingChangeSetSchema, type TradingChangeSetInput } from "@/schemas/trading-assistant";
import type { TradingOutlook } from "@/types/trading-assistant";

/**
 * Applies a proposal the user approved. Re-checked from scratch against the
 * journal as it is now — the card is not trusted — and written in one
 * transaction.
 */
export async function applyTradingChangesAction(
  input: TradingChangeSetInput
): Promise<ActionResult<TradingOutlook>> {
  return safe("trading-assistant", async () => {
    const ctx = await requireEffectiveContext();
    if (!canUseAssistant(ctx)) return { success: false, error: "The trading assistant is not available" };

    const parsed = tradingChangeSetSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    try {
      const applied = await applyTradingChanges(ctx.effectiveUserId, await getRequestTimeZone(), parsed.data);
      await logImpersonatedMutation({
        action: "tradingJournal.assistant.apply",
        entityTable: "trading_trades",
        metadata: { summary: parsed.data.summary, lines: applied.lines },
      });
      revalidatePath("/portal/trading");
      revalidatePath("/portal/plans", "layout");
      revalidatePath("/portal");
      return { success: true, data: applied.after };
    } catch (err) {
      if (err instanceof TradingChangeError) return { success: false, error: err.message };
      throw err;
    }
  });
}
