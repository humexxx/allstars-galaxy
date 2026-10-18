import { z } from "zod";

/** Any row id. zod v4's `z.uuid()` (the `z.string().uuid()` form is deprecated). */
export const idSchema = z.uuid();
export type IdData = z.infer<typeof idSchema>;

/**
 * A calendar day, `YYYY-MM-DD`. Postgres `date` columns carry no timezone, so
 * the string form is the value — not a Date, which would pick one up.
 */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a YYYY-MM-DD date");
export type IsoDateData = z.infer<typeof isoDateSchema>;

/** Non-negative money, up to 2 decimals — mirrors the DB CHECK constraints. */
export const moneySchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a non-negative number with up to 2 decimals");
export type MoneyData = z.infer<typeof moneySchema>;
