CREATE TYPE "public"."finance_plan_recurrence_type" AS ENUM('monthly_day', 'monthly_weekday', 'every_n_months');--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ADD COLUMN "recurrence_type" "finance_plan_recurrence_type" DEFAULT 'monthly_day' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ADD COLUMN "week_of_month" integer;--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ADD COLUMN "day_of_week" integer;--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ADD COLUMN "interval_months" integer;--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ADD COLUMN "recurrence_start" date;--> statement-breakpoint
ALTER TABLE "finance_plan_expenses" ADD COLUMN "recurrence_type" "finance_plan_recurrence_type" DEFAULT 'monthly_day' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plan_expenses" ADD COLUMN "week_of_month" integer;--> statement-breakpoint
ALTER TABLE "finance_plan_expenses" ADD COLUMN "day_of_week" integer;--> statement-breakpoint
ALTER TABLE "finance_plan_expenses" ADD COLUMN "interval_months" integer;--> statement-breakpoint
ALTER TABLE "finance_plan_expenses" ADD COLUMN "recurrence_start" date;--> statement-breakpoint
ALTER TABLE "finance_plan_incomes" ADD COLUMN "recurrence_type" "finance_plan_recurrence_type" DEFAULT 'monthly_day' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plan_incomes" ADD COLUMN "week_of_month" integer;--> statement-breakpoint
ALTER TABLE "finance_plan_incomes" ADD COLUMN "day_of_week" integer;--> statement-breakpoint
ALTER TABLE "finance_plan_incomes" ADD COLUMN "interval_months" integer;--> statement-breakpoint
ALTER TABLE "finance_plan_incomes" ADD COLUMN "recurrence_start" date;--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ADD CONSTRAINT "finance_plan_debts_week_of_month_chk" CHECK ("finance_plan_debts"."week_of_month" IS NULL OR ("finance_plan_debts"."week_of_month" >= 1 AND "finance_plan_debts"."week_of_month" <= 5));--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ADD CONSTRAINT "finance_plan_debts_day_of_week_chk" CHECK ("finance_plan_debts"."day_of_week" IS NULL OR ("finance_plan_debts"."day_of_week" >= 0 AND "finance_plan_debts"."day_of_week" <= 6));--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ADD CONSTRAINT "finance_plan_debts_interval_months_chk" CHECK ("finance_plan_debts"."interval_months" IS NULL OR ("finance_plan_debts"."interval_months" >= 1 AND "finance_plan_debts"."interval_months" <= 12));--> statement-breakpoint
ALTER TABLE "finance_plan_expenses" ADD CONSTRAINT "finance_plan_expenses_week_of_month_chk" CHECK ("finance_plan_expenses"."week_of_month" IS NULL OR ("finance_plan_expenses"."week_of_month" >= 1 AND "finance_plan_expenses"."week_of_month" <= 5));--> statement-breakpoint
ALTER TABLE "finance_plan_expenses" ADD CONSTRAINT "finance_plan_expenses_day_of_week_chk" CHECK ("finance_plan_expenses"."day_of_week" IS NULL OR ("finance_plan_expenses"."day_of_week" >= 0 AND "finance_plan_expenses"."day_of_week" <= 6));--> statement-breakpoint
ALTER TABLE "finance_plan_expenses" ADD CONSTRAINT "finance_plan_expenses_interval_months_chk" CHECK ("finance_plan_expenses"."interval_months" IS NULL OR ("finance_plan_expenses"."interval_months" >= 1 AND "finance_plan_expenses"."interval_months" <= 12));--> statement-breakpoint
ALTER TABLE "finance_plan_incomes" ADD CONSTRAINT "finance_plan_incomes_week_of_month_chk" CHECK ("finance_plan_incomes"."week_of_month" IS NULL OR ("finance_plan_incomes"."week_of_month" >= 1 AND "finance_plan_incomes"."week_of_month" <= 5));--> statement-breakpoint
ALTER TABLE "finance_plan_incomes" ADD CONSTRAINT "finance_plan_incomes_day_of_week_chk" CHECK ("finance_plan_incomes"."day_of_week" IS NULL OR ("finance_plan_incomes"."day_of_week" >= 0 AND "finance_plan_incomes"."day_of_week" <= 6));--> statement-breakpoint
ALTER TABLE "finance_plan_incomes" ADD CONSTRAINT "finance_plan_incomes_interval_months_chk" CHECK ("finance_plan_incomes"."interval_months" IS NULL OR ("finance_plan_incomes"."interval_months" >= 1 AND "finance_plan_incomes"."interval_months" <= 12));