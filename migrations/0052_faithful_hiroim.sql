-- Finance plans: opening balances are dated.
--   * balances_as_of: the calendar day the opening balances were last set on
--     (see db/schema.ts). Nullable — existing rows keep NULL and the
--     projection falls back to the creation day.
--   * initial_savings may be negative: a plan in deficit restates an
--     overdraft (finance_plan_confirmations dropped its check in 0051).
-- Both changes are backward compatible: code that predates them never reads
-- the column and never writes a negative balance.
ALTER TABLE "finance_plans" DROP CONSTRAINT "finance_plans_initial_savings_chk";--> statement-breakpoint
ALTER TABLE "finance_plans" ADD COLUMN "balances_as_of" date;
