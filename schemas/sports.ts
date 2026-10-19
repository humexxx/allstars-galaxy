import { z } from "zod";

import { SPORT_COMPETITIONS, SPORT_IDS } from "@/types/sports";

// Rejects unknown sport keys before they reach the service / DB.
export const sportIdSchema = z.enum(SPORT_IDS);

// Toggle payload used by the manage-favourites sheet. `isFavorite=true` upserts
// the (userId, sportId) row, `false` deletes it.
export const setSportFavoriteSchema = z.object({
  sportId: sportIdSchema,
  isFavorite: z.boolean(),
});

export type SetSportFavoriteData = z.infer<typeof setSportFavoriteSchema>;

// The championship a dashboard card shows, checked against that sport's own
// list; null hands the card back its own pick. A sport with no list (NBA,
// NFL, F1) has nothing to choose, so any value is refused.
export const setSportCompetitionSchema = z
  .object({
    sportId: sportIdSchema,
    competition: z.string().nullable(),
  })
  .refine(
    ({ sportId, competition }) => {
      const choices = SPORT_COMPETITIONS[sportId];
      return choices !== undefined && (competition === null || choices.includes(competition));
    },
    { message: "Unknown championship", path: ["competition"] }
  );

export type SetSportCompetitionData = z.infer<typeof setSportCompetitionSchema>;
