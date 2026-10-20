import { z } from "zod";

import { AI_MODEL_IDS } from "@/lib/ai/models";
import { isoDateSchema } from "@/schemas/common";

/** What an admin can change about the app's AI: either field, or both. */
export const updateAiSettingsSchema = z
  .object({
    model: z.enum(AI_MODEL_IDS).optional(),
    apiKeyExpiresOn: isoDateSchema.nullable().optional(),
  })
  .refine((v) => v.model !== undefined || v.apiKeyExpiresOn !== undefined, {
    message: "Nothing to change",
  });

export type UpdateAiSettingsData = z.infer<typeof updateAiSettingsSchema>;
