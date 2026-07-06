import { z } from "zod";

export const impersonationSchema = z.object({
  userId: z.string().uuid(),
});

export type ImpersonationData = z.infer<typeof impersonationSchema>;
