import { z } from "zod";

export const createAutomatedTaskSchema = z.object({
  roadPathId: z.string().uuid(),
});

export type CreateAutomatedTaskInput = z.infer<typeof createAutomatedTaskSchema>;
