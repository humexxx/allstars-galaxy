CREATE TYPE "public"."debt_strategy" AS ENUM('avalanche', 'snowball', 'none');--> statement-breakpoint
CREATE TYPE "public"."finance_snapshot_source" AS ENUM('system_cron', 'confirmation', 'manual');--> statement-breakpoint
CREATE TABLE "finance_plan_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"confirmation_month" date NOT NULL,
	"confirmed_savings" numeric(20, 2) NOT NULL,
	"confirmed_investments" numeric(20, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_plan_confirmations_savings_chk" CHECK ("finance_plan_confirmations"."confirmed_savings" >= 0),
	CONSTRAINT "finance_plan_confirmations_investments_chk" CHECK ("finance_plan_confirmations"."confirmed_investments" >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance_plan_debt_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"confirmation_id" uuid NOT NULL,
	"debt_id" uuid NOT NULL,
	"confirmed_balance" numeric(20, 2) NOT NULL,
	CONSTRAINT "finance_plan_debt_confirmations_balance_chk" CHECK ("finance_plan_debt_confirmations"."confirmed_balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance_plan_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"savings" numeric(20, 2) NOT NULL,
	"investments" numeric(20, 2) NOT NULL,
	"total_debt" numeric(20, 2) NOT NULL,
	"net_worth" numeric(20, 2) NOT NULL,
	"source" "finance_snapshot_source" DEFAULT 'system_cron' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_plans" ALTER COLUMN "months_ahead" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "finance_plans" ALTER COLUMN "months_ahead" SET DEFAULT 120;--> statement-breakpoint
ALTER TABLE "finance_plans" ALTER COLUMN "debt_strategy" SET DEFAULT 'avalanche'::"public"."debt_strategy";--> statement-breakpoint
ALTER TABLE "finance_plans" ALTER COLUMN "debt_strategy" SET DATA TYPE "public"."debt_strategy" USING "debt_strategy"::"public"."debt_strategy";--> statement-breakpoint
ALTER TABLE "finance_plans" ADD COLUMN "confirmation_day_of_month" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plan_confirmations" ADD CONSTRAINT "finance_plan_confirmations_plan_id_finance_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."finance_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plan_debt_confirmations" ADD CONSTRAINT "finance_plan_debt_confirmations_confirmation_id_finance_plan_confirmations_id_fk" FOREIGN KEY ("confirmation_id") REFERENCES "public"."finance_plan_confirmations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plan_debt_confirmations" ADD CONSTRAINT "finance_plan_debt_confirmations_debt_id_finance_plan_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."finance_plan_debts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plan_snapshots" ADD CONSTRAINT "finance_plan_snapshots_plan_id_finance_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."finance_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "finance_plan_confirmations_plan_month_uniq" ON "finance_plan_confirmations" USING btree ("plan_id","confirmation_month");--> statement-breakpoint
CREATE INDEX "finance_plan_confirmations_plan_id_idx" ON "finance_plan_confirmations" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_plan_debt_confirmations_uniq" ON "finance_plan_debt_confirmations" USING btree ("confirmation_id","debt_id");--> statement-breakpoint
CREATE INDEX "finance_plan_debt_confirmations_debt_id_idx" ON "finance_plan_debt_confirmations" USING btree ("debt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_plan_snapshots_plan_date_uniq" ON "finance_plan_snapshots" USING btree ("plan_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "finance_plan_snapshots_plan_id_idx" ON "finance_plan_snapshots" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "finance_plan_snapshots_date_idx" ON "finance_plan_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "finance_plans_auto_invest_method_id_idx" ON "finance_plans" USING btree ("auto_invest_method_id");--> statement-breakpoint
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_months_ahead_chk" CHECK ("finance_plans"."months_ahead" >= 1 AND "finance_plans"."months_ahead" <= 120);--> statement-breakpoint
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_initial_savings_chk" CHECK ("finance_plans"."initial_savings" >= 0);--> statement-breakpoint
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_initial_investments_chk" CHECK ("finance_plans"."initial_investments" >= 0);--> statement-breakpoint
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_savings_rate_chk" CHECK ("finance_plans"."monthly_savings_rate" >= 0);--> statement-breakpoint
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_surplus_chk" CHECK ("finance_plans"."surplus_to_debts_percent" >= 0 AND "finance_plans"."surplus_to_debts_percent" <= 1);--> statement-breakpoint
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_auto_invest_chk" CHECK ("finance_plans"."auto_invest_percent" >= 0 AND "finance_plans"."auto_invest_percent" <= 1);--> statement-breakpoint
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_confirmation_day_chk" CHECK ("finance_plans"."confirmation_day_of_month" >= 0 AND "finance_plans"."confirmation_day_of_month" <= 28);