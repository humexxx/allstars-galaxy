import { z } from "zod";

// One race of a season, as the classification action takes it. The bounds
// keep anything that is not a round number out of Jolpica's URL.
export const f1RaceRefSchema = z.object({
  season: z.number().int().min(1950).max(2100),
  round: z.number().int().min(1).max(40),
});

export type F1RaceRefData = z.infer<typeof f1RaceRefSchema>;

// One race weekend, as the session-results action takes it: the race and the
// window its sessions run in, which is how OpenF1 is asked for them. A
// weekend is three days; a week of slack covers a reschedule.
export const f1WeekendRefSchema = f1RaceRefSchema
  .extend({
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
  })
  .refine(({ from, to }) => {
    const span = Date.parse(to) - Date.parse(from);
    return span >= 0 && span <= 7 * 86_400_000;
  }, { message: "Not one weekend", path: ["to"] });

export type F1WeekendRefData = z.infer<typeof f1WeekendRefSchema>;
