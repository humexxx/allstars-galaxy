"use server";

import { revalidatePath } from "next/cache";

import { canUseAssistant } from "@/lib/ai/assistant/access";
import { safe, type ActionResult } from "@/lib/actions/safe";
import { planOperationContext } from "@/lib/services/finance-plan-operations";
import { logImpersonatedMutation, requireEffectiveContext } from "@/lib/services/impersonation";
import { applyPlanChanges, PlanChangeError } from "@/lib/services/plans-assistant-service";
import { planChangeSetSchema, type PlanChangeSetInput } from "@/schemas/plans-assistant";
import type { AppliedPlanChanges } from "@/types/plans-assistant";

/** Every plan surface and the dashboard card: one proposal can touch several plans. */
function revalidatePlans(): void {
  revalidatePath("/portal/plans", "layout");
  revalidatePath("/portal");
}

/**
 * Applies a proposal the user approved. Re-checked from scratch — the card is
 * not trusted — and written through the same plan operations as the forms.
 */
export async function applyPlanChangesAction(
  input: PlanChangeSetInput
): Promise<ActionResult<AppliedPlanChanges>> {
  return safe("plans-assistant", async () => {
    const ctx = await requireEffectiveContext();
    if (!canUseAssistant(ctx)) return { success: false, error: "The plans assistant is not available" };

    const parsed = planChangeSetSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    try {
      const applied = await applyPlanChanges(await planOperationContext(ctx.effectiveUserId), input);
      await logImpersonatedMutation({
        action: "financePlan.assistant.apply",
        entityTable: "finance_plans",
        metadata: { summary: parsed.data.summary, lines: applied.lines },
      });
      revalidatePlans();
      return { success: true, data: applied };
    } catch (err) {
      if (err instanceof PlanChangeError) {
        // A proposal that stopped part-way still wrote its first changes.
        revalidatePlans();
        return { success: false, error: err.message };
      }
      throw err;
    }
  });
}
