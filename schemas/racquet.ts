import { z } from "zod";

/**
 * Which tournament's draw is asked for: the men's, the only draws the hub
 * reads. The id's shape is the feed's own — `padelapi-747`,
 * `espn-315-2026-mens-singles` — so anything else is refused before it can
 * cost a provider request.
 */
export const racquetDrawSchema = z.discriminatedUnion("sport", [
  z.object({
    sport: z.literal("padel"),
    tournamentId: z.string().regex(/^padelapi-\d{1,9}$/),
  }),
  z.object({
    sport: z.literal("tennis"),
    tournamentId: z.string().regex(/^espn-\d{1,9}-\d{4}-mens-singles$/),
  }),
]);

export type RacquetDrawData = z.infer<typeof racquetDrawSchema>;
