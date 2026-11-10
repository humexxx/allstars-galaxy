import { z } from "zod";

import { idSchema } from "./common";

/** An instant with its offset, as the browser sends a picked date and time. */
const instantSchema = z.iso.datetime({ offset: true });

/** What a `numeric(20, 8)` column holds: nothing finer than its 8 decimals, nothing past its 12 digits. */
const SMALLEST = 0.00000001;
const LARGEST = 999_999_999_999;

const positive = (label: string) =>
  z.coerce
    .number()
    .positive(`${label} must be more than 0`)
    .min(SMALLEST, `${label} must be at least 0.00000001`)
    .max(LARGEST, `${label} is too large`);
const nonNegative = (label: string) =>
  z.coerce.number().min(0, `${label} cannot be negative`).max(LARGEST, `${label} is too large`);

const tradeFields = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Symbol is required")
    .max(24, "Symbol is at most 24 characters")
    .transform((s) => s.toUpperCase()),
  side: z.enum(["long", "short"]),
  quantity: positive("Quantity"),
  multiplier: positive("Multiplier").default(1),
  entryPrice: nonNegative("Entry price"),
  exitPrice: nonNegative("Exit price").nullable().default(null),
  openedAt: instantSchema,
  closedAt: instantSchema.nullable().default(null),
  fees: nonNegative("Fees").default(0),
  setup: z.string().trim().max(60).nullable().default(null),
  notes: z.string().trim().max(2000).nullable().default(null),
});

/** A trade is closed by its exit price and close time together, never one alone. */
function closesWhole(t: { exitPrice: number | null; closedAt: string | null; openedAt: string }): boolean {
  return (t.exitPrice == null) === (t.closedAt == null);
}
function closesAfterOpen(t: { closedAt: string | null; openedAt: string }): boolean {
  return t.closedAt == null || Date.parse(t.closedAt) >= Date.parse(t.openedAt);
}

export const tradeSchema = tradeFields
  .refine(closesWhole, { message: "A closed trade needs both its exit price and when it closed", path: ["exitPrice"] })
  .refine(closesAfterOpen, { message: "A trade cannot close before it opened", path: ["closedAt"] });
export type TradeInput = z.input<typeof tradeSchema>;
export type TradeData = z.infer<typeof tradeSchema>;

export const updateTradeSchema = tradeFields
  .extend({ id: idSchema })
  .refine(closesWhole, { message: "A closed trade needs both its exit price and when it closed", path: ["exitPrice"] })
  .refine(closesAfterOpen, { message: "A trade cannot close before it opened", path: ["closedAt"] });
export type UpdateTradeInput = z.input<typeof updateTradeSchema>;
export type UpdateTradeData = z.infer<typeof updateTradeSchema>;

export const closeTradeSchema = z.object({
  id: idSchema,
  exitPrice: nonNegative("Exit price"),
  closedAt: instantSchema,
  /** Fees of the closing order, added to the trade's. */
  fees: nonNegative("Fees").default(0),
});
export type CloseTradeInput = z.input<typeof closeTradeSchema>;
export type CloseTradeData = z.infer<typeof closeTradeSchema>;

export const cashMovementSchema = z.object({
  kind: z.enum(["deposit", "withdrawal"]),
  amount: z.coerce
    .number()
    .positive("Amount must be more than 0")
    .max(LARGEST, "Amount is too large")
    .refine((n) => Math.round(n * 100) / 100 === n, "Amount has at most 2 decimals"),
  occurredAt: instantSchema,
  note: z.string().trim().max(200).nullable().default(null),
});
export type CashMovementInput = z.input<typeof cashMovementSchema>;
export type CashMovementData = z.infer<typeof cashMovementSchema>;
