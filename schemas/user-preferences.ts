import { z } from "zod";

export const setShowContextAvatarSchema = z.object({
  showContextAvatar: z.boolean(),
});

export type SetShowContextAvatarInput = z.infer<
  typeof setShowContextAvatarSchema
>;
