import { z } from "zod";

import { sportIdSchema } from "@/schemas/sports";

/** What the browser says the user has open: the address, query included. */
export const sportsAssistantContextSchema = z.object({
  path: z.string().startsWith("/portal").max(500),
});

export type SportsAssistantContextData = z.infer<typeof sportsAssistantContextSchema>;

export const getSportInputSchema = z.object({
  sportId: sportIdSchema,
  competition: z
    .string()
    .max(40)
    .optional()
    .describe("A competition id from list_sports: a football league, or a LoL league or event. Football's default is the Champions League."),
  team: z
    .string()
    .max(60)
    .optional()
    .describe("Only this team's matches (a name, short name or code, e.g. \"Real Madrid\")."),
  tournament: z
    .string()
    .max(60)
    .optional()
    .describe("Padel or tennis: find the season's tournaments with this in their name, with their ids."),
});

export type GetSportInputData = z.infer<typeof getSportInputSchema>;

export const setFavoriteInputSchema = z.object({
  sportId: sportIdSchema,
  favorite: z.boolean().describe("true adds the sport to the user's favourites, false removes it."),
});

export type SetFavoriteInputData = z.infer<typeof setFavoriteInputSchema>;

export const sportsDestinationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("sport"),
    sportId: sportIdSchema,
    competition: z.string().max(40).optional().describe("A competition id from list_sports (football, LoL)."),
    tab: z.string().max(30).optional().describe("A tab id from list_sports; leave it out for the page's own pick."),
    tournamentId: z
      .string()
      .min(1)
      .max(80)
      .optional()
      .describe("Padel or tennis: a tournament id from get_sport, to open that tournament's page."),
    round: z.number().int().min(1).max(40).optional().describe("F1: a race's round from get_sport, to open that race's page."),
  }),
  z.object({
    kind: z.literal("page"),
    page: z.string().max(40).describe("A page id from list_pages."),
  }),
]);

export type SportsDestinationData = z.infer<typeof sportsDestinationSchema>;

export const navigateInputSchema = z.object({ destination: sportsDestinationSchema });

export type NavigateInputData = z.infer<typeof navigateInputSchema>;
