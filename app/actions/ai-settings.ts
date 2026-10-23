"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { updateAiSettings } from "@/lib/services/ai-service";
import { requireAdminCached } from "@/lib/services/auth-server";
import { updateAiSettingsSchema, type UpdateAiSettingsData } from "@/schemas/ai-settings";
import type { AiSettings } from "@/types/ai";

/** The model the assistant answers with, and when its API key expires. Admins only. */
export async function updateAiSettingsAction(
  input: UpdateAiSettingsData
): Promise<ActionResult<AiSettings>> {
  return safe("ai-settings", async () => {
    const admin = await requireAdminCached();
    const parsed = updateAiSettingsSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    const settings = await updateAiSettings(admin.id, parsed.data);
    // The settings pane, and the expiry notice every portal page carries.
    revalidatePath("/portal", "layout");
    return { success: true, data: settings };
  });
}
