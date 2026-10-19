import { z } from "zod";

/**
 * Which tournament's draw the details sheet asks for. The id's shape is the
 * feed's own — `padelapi-747`, `espn-315-2026-mens-singles` — so anything
 * else is refused before it can cost a provider request.
 */
export const racquetDrawSchema = z.discriminatedUnion("sport", [
  z.object({
    sport: z.literal("padel"),
    tour: z.enum(["wpt-men", "wpt-women"]),
    tournamentId: z.string().regex(/^padelapi-\d{1,9}$/),
  }),
  z.object({
    sport: z.literal("tennis"),
    tour: z.enum(["atp", "wta"]),
    tournamentId: z.string().regex(/^espn-\d{1,9}-\d{4}-(mens|womens)-singles$/),
  }),
]);

export type RacquetDrawData = z.infer<typeof racquetDrawSchema>;
