import { z } from "zod";

// One race of a season, as the classification action takes it. The bounds
// keep anything that is not a round number out of Jolpica's URL.
export const f1RaceRefSchema = z.object({
  season: z.number().int().min(1950).max(2100),
  round: z.number().int().min(1).max(40),
});

export type F1RaceRefData = z.infer<typeof f1RaceRefSchema>;
