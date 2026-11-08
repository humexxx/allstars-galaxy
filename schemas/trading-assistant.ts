import { z } from "zod";

import { idSchema } from "@/schemas/common";

/**
 * What the trading assistant may propose, and what Apply re-checks.
 *
 * Each trade change is validated afterwards with the journal's own
 * `tradeSchema`, so the forms and the assistant refuse the same things. The
 * descriptions are read by the model — they are the tool's documentation.
 */

const instant = z.iso
  .datetime({ offset: true })
  .describe('An instant with its UTC offset, e.g. "2026-11-08T14:30:00-06:00", in the user\'s time zone');

const when = (what: string) =>
  instant.optional().describe(`${what}. Omit it for "now": the moment the user applies the change`);

const price = (what: string) => z.number().nonnegative().describe(what);
const fees = z.number().nonnegative().optional().describe("Commissions and fees in dollars; 0 when not mentioned");

const tradeTarget = { tradeId: idSchema.describe("The trade's id, from get_journal") };

const opening = {
  symbol: z.string().trim().min(1).max(24).describe('The ticker or contract, e.g. "AAPL", "BTC", "ES"'),
  side: z.enum(["long", "short"]).describe("long profits when the price rises, short when it falls"),
  quantity: z.number().positive().describe("Shares, coins or contracts"),
  multiplier: z
    .number()
    .positive()
    .optional()
    .describe("Dollars per point per contract (ES 50, NQ 20, an option 100). Omit for stocks and crypto (1)"),
  entryPrice: price("The price the position was opened at"),
  openedAt: when("When the position was opened"),
  fees,
  setup: z.string().trim().max(60).optional().describe('The strategy, e.g. "Breakout"; reuse the journal\'s names'),
  notes: z.string().trim().max(2000).optional(),
};

const cash = {
  amount: z.number().positive().describe("Dollars, at most 2 decimals"),
  occurredAt: when("When the money moved"),
  note: z.string().trim().max(200).optional(),
};

export const tradingChangeSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("open_trade"), ...opening }).describe("Open a position that is still running"),
  z
    .object({
      op: z.literal("add_trade"),
      ...opening,
      openedAt: instant.describe("When the position was opened"),
      exitPrice: price("The price it was closed at"),
      closedAt: when("When it was closed"),
    })
    .describe("Record a trade that is already closed"),
  z
    .object({
      op: z.literal("close_trade"),
      ...tradeTarget,
      exitPrice: price("The price it was closed at"),
      closedAt: when("When it was closed"),
      fees: fees.describe("Fees of the closing order, added to the trade's"),
    })
    .describe("Close an open trade"),
  z
    .object({
      op: z.literal("update_trade"),
      ...tradeTarget,
      patch: z
        .object({
          symbol: opening.symbol,
          side: opening.side,
          quantity: opening.quantity,
          multiplier: z.number().positive(),
          entryPrice: opening.entryPrice,
          exitPrice: price("The exit price; null reopens the trade").nullable(),
          openedAt: instant,
          closedAt: instant.nullable().describe("null reopens the trade, with exitPrice null"),
          fees: z.number().nonnegative().describe("The trade's total fees"),
          setup: opening.setup.unwrap().nullable(),
          notes: z.string().trim().max(2000).nullable(),
        })
        .partial()
        .describe("Only the fields that change"),
    })
    .describe("Correct a trade"),
  z.object({ op: z.literal("delete_trade"), ...tradeTarget }).describe("Delete a trade"),
  z.object({ op: z.literal("deposit"), ...cash }).describe("Money into the trading account"),
  z.object({ op: z.literal("withdraw"), ...cash }).describe("Money out of the trading account"),
  z
    .object({
      op: z.literal("delete_cash_movement"),
      movementId: idSchema.describe("The deposit's or withdrawal's id, from get_journal"),
    })
    .describe("Delete a deposit or withdrawal"),
]);
export type TradingChange = z.infer<typeof tradingChangeSchema>;

export const tradingChangeSetSchema = z.object({
  summary: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe('What the changes do, in a few words in the user\'s language, e.g. "Close the NVDA long at 142.30"'),
  changes: z.array(tradingChangeSchema).min(1).max(25).describe("Applied in order"),
});
export type TradingChangeSetInput = z.input<typeof tradingChangeSetSchema>;
export type TradingChangeSet = z.infer<typeof tradingChangeSetSchema>;
