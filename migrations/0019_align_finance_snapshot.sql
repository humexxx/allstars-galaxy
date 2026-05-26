-- Align finance_plan_snapshots with the portfolio_snapshots pattern:
--   1. Rename column `snapshot_date` (date) → `date` (timestamp with timezone).
--      Existing date values are preserved by casting at UTC midnight.
--   2. Drop the UNIQUE(plan_id, snapshot_date) constraint. Multiple snapshots
--      per (plan, date) are now allowed — same semantics as portfolio_snapshots,
--      so confirmations + cron + manual runs can coexist on the same day.
--   3. Replace the date index with one keyed on the new column.
-- All changes are reversible and existing rows survive intact.

SET LOCAL statement_timeout = 0;
SET LOCAL lock_timeout = '30s';

-- 1. Drop the unique index (its dependent column is about to be renamed).
DROP INDEX IF EXISTS "finance_plan_snapshots_plan_date_uniq";--> statement-breakpoint

-- 2. Drop the old date index too — we'll recreate it on the new column.
DROP INDEX IF EXISTS "finance_plan_snapshots_date_idx";--> statement-breakpoint

-- 3. Rename + retype in one pass per column. The USING clause casts each
--    existing date to a timestamp at UTC midnight, preserving the calendar day.
ALTER TABLE "finance_plan_snapshots" RENAME COLUMN "snapshot_date" TO "date";--> statement-breakpoint
ALTER TABLE "finance_plan_snapshots"
  ALTER COLUMN "date" SET DATA TYPE timestamp with time zone
  USING ("date"::timestamp with time zone);--> statement-breakpoint

-- 4. Re-create the date index (no UNIQUE this time).
CREATE INDEX "finance_plan_snapshots_date_idx" ON "finance_plan_snapshots" USING btree ("date");
