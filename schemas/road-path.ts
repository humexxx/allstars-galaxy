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

export const roadPathFrequencySchema = z.enum(["daily", "every_other_day", "weekly", "biweekly", "monthly"]);

export const createRoadPathSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().max(2000, "Description too long").nullable().optional(),
  targetValue: z.number().positive("Must be more than 0").nullable().optional(),
  unit: z.string().max(50, "Unit too long").nullable().optional(),
  startDate: instantSchema,
  targetDate: instantSchema.nullable().optional(),
  autoCreateTasks: z.boolean().optional(),
  taskFrequency: roadPathFrequencySchema.nullable().optional(),
  createFirstTask: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.autoCreateTasks && !data.taskFrequency) {
      return false;
    }
    return true;
  },
  {
    message: "Task frequency is required when auto-create tasks is enabled",
    path: ["taskFrequency"],
  }
);

export type CreateRoadPathInput = z.input<typeof createRoadPathSchema>;
export type CreateRoadPathData = z.output<typeof createRoadPathSchema>;

export const updateRoadPathSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1, "Title is required").max(200, "Title too long").optional(),
  description: z.string().max(2000, "Description too long").nullable().optional(),
  targetValue: z.number().positive("Must be more than 0").nullable().optional(),
  currentValue: z.number().min(0).optional(),
  unit: z.string().max(50, "Unit too long").nullable().optional(),
  targetDate: instantSchema.nullable().optional(),
  autoCreateTasks: z.boolean().optional(),
  taskFrequency: roadPathFrequencySchema.nullable().optional(),
  completedAt: instantSchema.nullable().optional(),
});

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
