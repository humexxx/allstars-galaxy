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

const symbolSchema = z
  .string()
  .trim()
  .min(1, "Instrument is required")
  .max(24, "Instrument is at most 24 characters")
  .transform((s) => s.toUpperCase());
const notesSchema = z.string().trim().max(2000).nullable().default(null);

/**
 * What a trade made, to the cent; negative for a loss. A number and nothing
 * coerced into one: an empty field or a null would read as a trade that made $0.
 */
const pnlSchema = z
  .number("P&L must be a number")
  .min(-LARGEST, "P&L is too large")
  .max(LARGEST, "P&L is too large")
  .refine((n) => Math.round(n * 100) / 100 === n, "P&L has at most 2 decimals");

const tradeFields = z.object({
  symbol: symbolSchema,
  side: z.enum(["long", "short"]),
  quantity: positive("Quantity"),
  multiplier: positive("Multiplier").default(1),
  entryPrice: nonNegative("Entry price"),
  exitPrice: nonNegative("Exit price").nullable().default(null),
  openedAt: instantSchema,
  closedAt: instantSchema.nullable().default(null),
  fees: nonNegative("Fees").default(0),
  setup: z.string().trim().max(60).nullable().default(null),
  notes: notesSchema,
});

/** A trade is closed by its exit price and close time together, never one alone. */
function closesWhole(t: { exitPrice: number | null; closedAt: string | null; openedAt: string }): boolean {
  return (t.exitPrice == null) === (t.closedAt == null);
}
function closesAfterOpen(t: { closedAt: string | null; openedAt: string }): boolean {
  return t.closedAt == null || Date.parse(t.closedAt) >= Date.parse(t.openedAt);
}

const CLOSES_AFTER_OPEN = { message: "A trade cannot close before it opened", path: ["closedAt"] };

/** A trade with its whole position — what the assistant records. */
export const tradeSchema = tradeFields
  .refine(closesWhole, { message: "A closed trade needs both its exit price and when it closed", path: ["exitPrice"] })
  .refine(closesAfterOpen, CLOSES_AFTER_OPEN);
export type TradeInput = z.input<typeof tradeSchema>;
export type TradeData = z.infer<typeof tradeSchema>;

/**
 * A trade as the journal's form takes it: what was traded, when, and what it
 * made. The position behind the result is not asked for.
 */
const tradeResultFields = z.object({
  symbol: symbolSchema,
  openedAt: instantSchema,
  closedAt: instantSchema.nullable().default(null),
  pnl: pnlSchema.nullable().default(null),
  notes: notesSchema,
});

function resultClosesWhole(t: { pnl: number | null; closedAt: string | null }): boolean {
  return (t.pnl == null) === (t.closedAt == null);
}
const RESULT_CLOSES_WHOLE = { message: "A closed trade needs both its P&L and when it closed", path: ["pnl"] };

export const tradeResultSchema = tradeResultFields
  .refine(resultClosesWhole, RESULT_CLOSES_WHOLE)
  .refine(closesAfterOpen, CLOSES_AFTER_OPEN);
export type TradeResultInput = z.input<typeof tradeResultSchema>;
export type TradeResultData = z.infer<typeof tradeResultSchema>;

export const updateTradeResultSchema = tradeResultFields
  .extend({ id: idSchema })
  .refine(resultClosesWhole, RESULT_CLOSES_WHOLE)
  .refine(closesAfterOpen, CLOSES_AFTER_OPEN);
export type UpdateTradeResultInput = z.input<typeof updateTradeResultSchema>;
export type UpdateTradeResultData = z.infer<typeof updateTradeResultSchema>;

export const closeTradeSchema = z.object({
  id: idSchema,
  pnl: pnlSchema,
  closedAt: instantSchema,
});
export type CloseTradeInput = z.input<typeof closeTradeSchema>;
export type CloseTradeData = z.infer<typeof closeTradeSchema>;

/** What the instrument search is asked: a ticker or part of a name. */
export const instrumentQuerySchema = z.string().trim().min(2).max(40);

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
