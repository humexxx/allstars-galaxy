"use server";

import { revalidatePath } from "next/cache";

import { safe } from "@/lib/actions/safe";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import { setShowContextAvatar } from "@/lib/services/user-preferences-service";
import {
  setShowContextAvatarSchema,
  type SetShowContextAvatarInput,
} from "@/schemas/user-preferences";

const SETTINGS_PATH = "/portal/settings";

export async function setShowContextAvatarAction(
  input: SetShowContextAvatarInput
) {
  return safe("user-preferences", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = setShowContextAvatarSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid input" };
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
    return { success: true as const };
  });
}
