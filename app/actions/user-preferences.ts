"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import {
  setFinanceMilestones,
  setShowContextAvatar,
} from "@/lib/services/user-preferences-service";
import {
  setFinanceMilestonesSchema,
  setShowContextAvatarSchema,
  type SetFinanceMilestonesInput,
  type SetShowContextAvatarData,
} from "@/schemas/user-preferences";

const SETTINGS_PATH = "/portal/settings";

export async function setShowContextAvatarAction(
  input: SetShowContextAvatarData
): Promise<ActionResult> {
  return safe("user-preferences", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = setShowContextAvatarSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    await setShowContextAvatar(
      ctx.effectiveUserId,
      parsed.data.showContextAvatar
    );
    await logImpersonatedMutation({
      action: parsed.data.showContextAvatar
        ? "contextAvatar.enable"
        : "contextAvatar.disable",
      entityTable: "user_preferences",
    });
    revalidatePath(SETTINGS_PATH);
    // The avatar renders from the plans layout, so invalidate the whole subtree.
    revalidatePath("/portal/plans", "layout");
    return { success: true };
  });
}

export async function setFinanceMilestonesAction(
  input: SetFinanceMilestonesInput
): Promise<ActionResult<number[]>> {
  return safe("user-preferences", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = setFinanceMilestonesSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid milestones" };
    }
    await setFinanceMilestones(ctx.effectiveUserId, parsed.data.milestones);
    await logImpersonatedMutation({
      action: "financeMilestones.update",
      entityTable: "user_preferences",
      after: { milestones: parsed.data.milestones },
    });
    revalidatePath(SETTINGS_PATH);
    // Every plan chart annotates these, so invalidate the whole plans subtree.
    revalidatePath("/portal/plans", "layout");
    return { success: true, data: parsed.data.milestones };
  });
}
