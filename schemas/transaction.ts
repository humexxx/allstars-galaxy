import { z } from "zod";

import { idSchema, moneySchema } from "./common";

export const createTransactionSchema = z.object({
  investmentMethodId: idSchema,
  amount: moneySchema.refine((value) => parseFloat(value) > 0, "Amount must be greater than zero"),
  date: z.coerce.date(),
  notes: z.string().max(2000).optional().nullable(),
  userId: idSchema.optional(),
});

export type CreateTransactionData = z.infer<typeof createTransactionSchema>;
