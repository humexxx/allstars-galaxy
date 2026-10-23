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

/** Weekdays a habit is due, 0 = Sunday … 6 = Saturday. Empty: no schedule. */
export const scheduleDaysSchema = z
  .array(z.number().int().min(0).max(6))
  .max(7)
  .transform((days) => [...new Set(days)].sort((a, b) => a - b));

const roadPathFields = {
  title: z.string().trim().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().max(2000, "Description too long").nullable().optional(),
  targetValue: z.number().positive("Must be more than 0").nullable().optional(),
  unit: z.string().max(50, "Unit too long").nullable().optional(),
  startDate: instantSchema,
  targetDate: instantSchema.nullable().optional(),
  scheduleDays: scheduleDaysSchema.optional(),
};

function targetAfterStart(data: { startDate?: Date; targetDate?: Date | null }): boolean {
  return !data.startDate || !data.targetDate || data.targetDate >= data.startDate;
}

const targetAfterStartIssue = {
  message: "The target date can't be before the start date",
  path: ["targetDate"],
};

export const createRoadPathSchema = z
  .object(roadPathFields)
  .refine(targetAfterStart, targetAfterStartIssue);

export type CreateRoadPathInput = z.input<typeof createRoadPathSchema>;
export type CreateRoadPathData = z.output<typeof createRoadPathSchema>;

/** Every field of a road path, any subset at a time. */
export const updateRoadPathSchema = z
  .object({
    id: idSchema,
    ...roadPathFields,
    title: roadPathFields.title.optional(),
    startDate: instantSchema.optional(),
    completedAt: instantSchema.nullable().optional(),
  })
  .refine(targetAfterStart, targetAfterStartIssue);

export type UpdateRoadPathInput = z.input<typeof updateRoadPathSchema>;
export type UpdateRoadPathData = z.output<typeof updateRoadPathSchema>;

export const createRoadPathMilestoneSchema = z.object({
  roadPathId: idSchema,
  title: z.string().trim().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().max(2000, "Description too long").nullable().optional(),
  targetValue: z.number().positive("Must be more than 0").nullable().optional(),
  /** Optional: the action asks the database where the end of the list is. A
   *  client counting the prop it was rendered with gave every milestone after
   *  the first the same order. */
  order: z.number().min(0).optional(),
});

export type CreateRoadPathMilestoneData = z.infer<typeof createRoadPathMilestoneSchema>;

export const updateRoadPathMilestoneSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1, "Title is required").max(200, "Title too long").optional(),
  description: z.string().max(2000, "Description too long").nullable().optional(),
  targetValue: z.number().positive("Must be more than 0").nullable().optional(),
  order: z.number().min(0).optional(),
  completedAt: instantSchema.nullable().optional(),
});

// `completedAt` is transformed, so the action takes the input shape and the
// service the parsed one.
export type UpdateRoadPathMilestoneInput = z.input<typeof updateRoadPathMilestoneSchema>;
export type UpdateRoadPathMilestoneData = z.output<typeof updateRoadPathMilestoneSchema>;

export const createRoadPathProgressSchema = z.object({
  roadPathId: idSchema,
  // An empty number field reads as NaN; say what to do instead of "expected
  // number, received NaN".
  value: z.number({ error: "Enter a value" }).min(0, "Can't be negative"),
  notes: z.string().max(500, "Notes too long").nullable().optional(),
  date: instantSchema.optional(),
});

export type CreateRoadPathProgressInput = z.input<typeof createRoadPathProgressSchema>;
export type CreateRoadPathProgressData = z.output<typeof createRoadPathProgressSchema>;
