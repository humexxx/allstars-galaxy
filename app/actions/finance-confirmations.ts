"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

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
    })
  ),
});

export type ConfirmActualsInput = z.infer<typeof confirmationSchema>;

export async function saveConfirmationAction(
  input: ConfirmActualsInput
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const ctx = await requireEffectiveContext();
    const parsed = confirmationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    await saveConfirmation(ctx.effectiveUserId, parsed.data);
    revalidatePath("/portal");
    revalidatePath(`/portal/plans/${parsed.data.planId}`);
    return { success: true };
  } catch (err) {
    console.error("saveConfirmationAction failed:", err);
    return { success: false, error: "Failed to save confirmation" };
  }
}
