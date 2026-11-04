import { z } from "zod";

import { FOOTBALL_COMPETITION_IDS, SPORT_COMPETITIONS, SPORT_IDS } from "@/types/sports";

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
// list; null hands the card back its own pick. A sport missing from
// SPORT_COMPETITIONS has nothing to choose, so any value is refused.
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

const teamIdsSchema = z.array(z.string().trim().min(1).max(64)).max(64);

// The teams a match list is narrowed to, for one list: a football league, or
// a US league's own (`TeamFilterList`). An empty list is every team.
export const setSportTeamFilterSchema = z.discriminatedUnion("sportId", [
  z.object({
    sportId: z.literal("football"),
    competition: z.enum(FOOTBALL_COMPETITION_IDS),
    teamIds: teamIdsSchema,
  }),
  z.object({
    sportId: z.literal("nba"),
    competition: z.literal("nba"),
    teamIds: teamIdsSchema,
  }),
  z.object({
    sportId: z.literal("nfl"),
    competition: z.literal("nfl"),
    teamIds: teamIdsSchema,
  }),
  z.object({
    sportId: z.literal("mlb"),
    competition: z.literal("mlb"),
    teamIds: teamIdsSchema,
  }),
  z.object({
    sportId: z.literal("nhl"),
    competition: z.literal("nhl"),
    teamIds: teamIdsSchema,
  }),
]);

export type SetSportTeamFilterData = z.infer<typeof setSportTeamFilterSchema>;
