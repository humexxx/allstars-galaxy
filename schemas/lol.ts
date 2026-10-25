import { z } from "zod";

import { LOL_LEAGUE_REGIONS } from "@/types/sports";

/**
 * Which of a league's splits the view asks for. A league's own region only —
 * an international event has one tournament a season — and Lolesports' ids
 * are long numbers, so anything else is refused before it costs a request.
 */
export const lolSplitSchema = z.object({
  region: z.enum(LOL_LEAGUE_REGIONS),
  tournamentId: z.string().regex(/^\d{6,25}$/),
});

export type LolSplitData = z.infer<typeof lolSplitSchema>;
