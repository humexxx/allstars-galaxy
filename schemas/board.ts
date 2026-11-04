import { z } from "zod";

import { idSchema, isoDateSchema } from "@/schemas/common";

export const taskPrioritySchema = z.enum(["low", "medium", "high"]);

export const createBoardColumnSchema = z.object({
  name: z.string().trim().min(1, "Column name is required").max(50, "Column name too long"),
  order: z.number().min(0),
});

export type CreateBoardColumnData = z.infer<typeof createBoardColumnSchema>;

export const updateBoardColumnSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1, "Column name is required").max(50, "Column name too long").optional(),
  order: z.number().min(0).optional(),
});

export type UpdateBoardColumnData = z.infer<typeof updateBoardColumnSchema>;

// No `roadPathId`: a habit's task is put on the board by its schedule, and a
// client-chosen one was never checked to be the caller's.
export const createBoardTaskSchema = z.object({
  columnId: idSchema,
  /** The day's board it goes on. */
  boardDate: isoDateSchema,
  title: z.string().trim().min(1, "Task title is required").max(200, "Task title too long"),
  description: z.string().max(2000, "Description too long").nullable().optional(),
  priority: taskPrioritySchema.nullable().optional(),
  dueDate: z.date().nullable().optional(),
});

export type CreateBoardTaskData = z.infer<typeof createBoardTaskSchema>;

/** What the task form edits. Moving to another column is a move, done by the service. */
export const updateBoardTaskSchema = z.object({
  id: idSchema,
  columnId: idSchema.optional(),
  title: z.string().trim().min(1, "Task title is required").max(200, "Task title too long").optional(),
  description: z.string().max(2000, "Description too long").nullable().optional(),
  priority: taskPrioritySchema.nullable().optional(),
  dueDate: z.date().nullable().optional(),
});

export type UpdateBoardTaskData = z.infer<typeof updateBoardTaskSchema>;

export const reorderTasksSchema = z.object({
  taskId: idSchema,
  destinationColumnId: idSchema,
  order: z.number().int().min(0),
});

export type ReorderTasksData = z.infer<typeof reorderTasksSchema>;

/** The answer to "move them to today?": each offered task is moved or left. */
export const carryOverSchema = z.object({
  moveIds: z.array(idSchema).max(500),
  leaveIds: z.array(idSchema).max(500),
});

export type CarryOverData = z.infer<typeof carryOverSchema>;
