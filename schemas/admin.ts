import { z } from "zod";

import { idSchema } from "./common";
import { userRoleSchema } from "./user";

export const updateUserRoleSchema = z.object({
  userId: idSchema,
  role: userRoleSchema,
});

export type UpdateUserRoleData = z.infer<typeof updateUserRoleSchema>;

export const adminTransactionIdSchema = idSchema;

const adminStatusFilterSchema = z.enum(["pending", "approved", "rejected"]);

/**
 * The approvals queue's URL filters. A missing status means the default
 * pending queue; "all" (or anything unrecognised) means no status filter. A
 * malformed value never fails the page — the user-id box pushes every
 * keystroke into the URL, and a partial id is "no filter yet", not an error.
 */
export const adminTransactionFiltersSchema = z.object({
  status: z
    .string()
    .optional()
    .catch(undefined)
    .transform((v) =>
      v === undefined ? "pending" : adminStatusFilterSchema.safeParse(v).data
    ),
  type: z.enum(["buy", "withdrawal"]).optional().catch(undefined),
  userId: idSchema.optional().catch(undefined),
});

export type AdminTransactionFiltersData = z.infer<typeof adminTransactionFiltersSchema>;
