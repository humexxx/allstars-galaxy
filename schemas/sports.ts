import { z } from "zod";

// SportId enum mirrors the literal union in /types/sports.ts. Keeping it as a
// flat enum here means the action layer can reject unknown sport keys before
// hitting the service / DB.
export const sportIdSchema = z.enum([
  "football",
  "padel",
  "f1",
  "nba",
  "tennis",
  "nfl",
  "lol",
]);

// Toggle payload used by the manage-favourites sheet. `isFavorite=true` upserts
// the (userId, sportId) row, `false` deletes it.
export const setSportFavoriteSchema = z.object({
  sportId: sportIdSchema,
  isFavorite: z.boolean(),
});

export type SetSportFavoriteInput = z.infer<typeof setSportFavoriteSchema>;
