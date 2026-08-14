import { z } from "zod";

import { userRoleEnum } from "./user";

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: userRoleEnum,
});

export type UpdateUserRoleData = z.infer<typeof updateUserRoleSchema>;

export const adminTransactionIdSchema = z.string().uuid();

export type AdminTransactionIdData = z.infer<typeof adminTransactionIdSchema>;
