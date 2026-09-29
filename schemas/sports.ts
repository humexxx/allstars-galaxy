import { z } from "zod";

import { SPORT_IDS } from "@/types/sports";

// Rejects unknown sport keys before they reach the service / DB.
export const sportIdSchema = z.enum(SPORT_IDS);

// Toggle payload used by the manage-favourites sheet. `isFavorite=true` upserts
// the (userId, sportId) row, `false` deletes it.
export const setSportFavoriteSchema = z.object({
  sportId: sportIdSchema,
  isFavorite: z.boolean(),
});

export type SetSportFavoriteData = z.infer<typeof setSportFavoriteSchema>;
