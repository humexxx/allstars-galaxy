"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { saveConfirmation } from "@/lib/services/finance-confirmation-service";

const confirmationSchema = z.object({
  planId: z.string().uuid(),
  confirmedSavings: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  confirmedInvestments: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  notes: z.string().max(1000).optional().nullable(),
  debtBalances: z.array(
    z.object({
      debtId: z.string().uuid(),
      confirmedBalance: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid balance"),
    }),
  ),
});

export type ConfirmActualsInput = z.infer<typeof confirmationSchema>;

export async function saveConfirmationAction(
  input: ConfirmActualsInput,
): Promise<ActionResult> {
  return safe("finance-confirmations", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = confirmationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    await saveConfirmation(ctx.effectiveUserId, parsed.data);
    // Only revalidate the specific plan page — confirmation never affects the
    // sibling /portal landing or other plans.
    revalidatePath(`/portal/plans/${parsed.data.planId}`);
    return { success: true };
  });
}
