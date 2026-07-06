"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { saveConfirmation } from "@/lib/services/finance-confirmation-service";
import { confirmationSchema, type ConfirmationData } from "@/schemas/finance-confirmations";

export async function saveConfirmationAction(
  input: ConfirmationData,
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
