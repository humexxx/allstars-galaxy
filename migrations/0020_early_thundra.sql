-- Add support for recurring + one-time finance plan lines.
--
-- For both incomes and expenses we now distinguish between:
--   kind='recurring' — perpetual monthly stream (the legacy default)
--   kind='one_time'  — lump sum on a specific `date`
--
-- `day_of_month` is calendar-only metadata (which day of the month a recurring
-- line is paid). The projection still aggregates monthly and ignores it.
--
-- Only incomes get `start_date`/`end_date` for now — they cap a recurring
-- income to a finite window (null on either side = perpetual on that side).
-- Expenses stay perpetual unless modelled as one-time.
--
-- Pure additive migration: every new column is nullable or has a default that
-- preserves the existing behaviour. No rewrites, no locks beyond ADD COLUMN.

CREATE TYPE "public"."finance_plan_line_kind" AS ENUM('recurring', 'one_time');--> statement-breakpoint

ALTER TABLE "finance_plan_expenses" ADD COLUMN "kind" "finance_plan_line_kind" DEFAULT 'recurring' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plan_expenses" ADD COLUMN "day_of_month" integer;--> statement-breakpoint
ALTER TABLE "finance_plan_expenses" ADD COLUMN "date" date;--> statement-breakpoint

ALTER TABLE "finance_plan_incomes" ADD COLUMN "kind" "finance_plan_line_kind" DEFAULT 'recurring' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plan_incomes" ADD COLUMN "day_of_month" integer;--> statement-breakpoint
ALTER TABLE "finance_plan_incomes" ADD COLUMN "date" date;--> statement-breakpoint
ALTER TABLE "finance_plan_incomes" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "finance_plan_incomes" ADD COLUMN "end_date" date;--> statement-breakpoint

ALTER TABLE "finance_plan_expenses" ADD CONSTRAINT "finance_plan_expenses_day_of_month_chk" CHECK ("finance_plan_expenses"."day_of_month" IS NULL OR ("finance_plan_expenses"."day_of_month" >= 1 AND "finance_plan_expenses"."day_of_month" <= 31));--> statement-breakpoint
ALTER TABLE "finance_plan_incomes" ADD CONSTRAINT "finance_plan_incomes_day_of_month_chk" CHECK ("finance_plan_incomes"."day_of_month" IS NULL OR ("finance_plan_incomes"."day_of_month" >= 1 AND "finance_plan_incomes"."day_of_month" <= 31));
