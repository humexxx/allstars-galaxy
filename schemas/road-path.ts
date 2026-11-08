import { z } from "zod";

import { idSchema } from "@/schemas/common";

/**
 * A day picked in a form arrives as `YYYY-MM-DD`, and `new Date()` reads that
 * as UTC midnight — which is the convention: a road path's start and target
 * dates are CALENDAR DAYS stored as UTC midnight, and every surface reads the
 * day back in UTC (`calendarDayKey` in `components/productivity/zoned-date`).
 * Full timestamps and Dates are taken as the instants they are.
 */
function toInstant(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

const instantSchema = z.union([z.string(), z.date()]).transform(toInstant);

/** Weekdays a habit is due, 0 = Sunday … 6 = Saturday. At least one: a road path is a habit. */
export const scheduleDaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1, "Pick at least one day")
  .max(7)
  .transform((days) => [...new Set(days)].sort((a, b) => a - b));

/**
 * A road path is a habit: what it is, the weekdays it is due on, and the day
 * it starts. It once could also be a goal measured against a target (a
 * figure, a unit, a target date, milestones, a progress log); that model is
 * gone, and those columns stay only until production stops reading them.
 */
const roadPathFields = {
  title: z.string().trim().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().max(2000, "Description too long").nullable().optional(),
  startDate: instantSchema,
  scheduleDays: scheduleDaysSchema,
};

export const createRoadPathSchema = z.object(roadPathFields);

export type CreateRoadPathInput = z.input<typeof createRoadPathSchema>;
export type CreateRoadPathData = z.output<typeof createRoadPathSchema>;

/** Every field of a road path, any subset at a time. */
export const updateRoadPathSchema = z.object({
  id: idSchema,
  title: roadPathFields.title.optional(),
  description: roadPathFields.description,
  startDate: instantSchema.optional(),
  scheduleDays: scheduleDaysSchema.optional(),
  completedAt: instantSchema.nullable().optional(),
});

export type UpdateRoadPathInput = z.input<typeof updateRoadPathSchema>;
export type UpdateRoadPathData = z.output<typeof updateRoadPathSchema>;

/** The user's road paths, in the order they now go. */
export const reorderRoadPathsSchema = z.object({
  ids: z.array(idSchema).min(1).max(500),
});

export type ReorderRoadPathsData = z.infer<typeof reorderRoadPathsSchema>;
