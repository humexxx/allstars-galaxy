import { z } from "zod";

export const createTransactionSchema = z.object({
  investmentMethodId: z.string().uuid("Invalid investment method"),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive number with up to 2 decimals")
    .refine((value) => parseFloat(value) > 0, "Amount must be greater than zero"),
  date: z.coerce.date(),
  notes: z.string().max(2000).optional().nullable(),
  userId: z.string().uuid().optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
