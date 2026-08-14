import { z } from "zod";

export const setShowContextAvatarSchema = z.object({
  showContextAvatar: z.boolean(),
});

export type SetShowContextAvatarInput = z.infer<
  typeof setShowContextAvatarSchema
>;

/** Upper bound on a single milestone — a trillion is well past any plan. */
const MAX_MILESTONE = 1_000_000_000_000;
/**
 * Cap on how many milestones render. Labels sit on ONE row and are never
 * dropped, so past a certain count they simply overlap — this is the guard
 * rail on that, not a layout constraint.
 */
export const MAX_MILESTONES = 12;

export const setFinanceMilestonesSchema = z.object({
  milestones: z
    .array(z.number().finite().min(0).max(MAX_MILESTONE))
    .max(MAX_MILESTONES)
    // Sorted + de-duplicated here so the chart never has to care: two equal
    // milestones would stack two labels on the same pixel.
    .transform((values) => [...new Set(values)].sort((a, b) => a - b)),
});

export type SetFinanceMilestonesInput = z.input<
  typeof setFinanceMilestonesSchema
>;
