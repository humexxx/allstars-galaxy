import { z } from "zod";

import { idSchema } from "@/schemas/common";

export const createAutomatedTaskSchema = z.object({
  roadPathId: idSchema,
});

export type CreateAutomatedTaskData = z.infer<typeof createAutomatedTaskSchema>;
