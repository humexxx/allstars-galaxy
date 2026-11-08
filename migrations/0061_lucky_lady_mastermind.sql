SET statement_timeout = 0;--> statement-breakpoint
SET lock_timeout = '30s';--> statement-breakpoint
ALTER TABLE "finance_plan_confirmations" DROP CONSTRAINT "finance_plan_confirmations_plan_id_finance_plans_id_fk";
--> statement-breakpoint
ALTER TABLE "finance_plan_debt_confirmations" DROP CONSTRAINT "finance_plan_debt_confirmations_debt_id_finance_plan_debts_id_fk";
--> statement-breakpoint
ALTER TABLE "finance_plan_snapshot_debts" DROP CONSTRAINT "finance_plan_snapshot_debts_debt_id_finance_plan_debts_id_fk";
--> statement-breakpoint
ALTER TABLE "finance_plan_snapshots" DROP CONSTRAINT "finance_plan_snapshots_plan_id_finance_plans_id_fk";
--> statement-breakpoint
ALTER TABLE "finance_plan_confirmations" ALTER COLUMN "plan_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plan_debt_confirmations" ALTER COLUMN "debt_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plan_snapshot_debts" ALTER COLUMN "debt_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plan_snapshots" ALTER COLUMN "plan_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plan_confirmations" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "finance_plan_debt_confirmations" ADD COLUMN "debt_key" uuid;--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ADD COLUMN "debt_key" uuid;--> statement-breakpoint
ALTER TABLE "finance_plan_snapshot_debts" ADD COLUMN "debt_key" uuid;--> statement-breakpoint
ALTER TABLE "finance_plan_snapshots" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "finance_plan_confirmations" ADD CONSTRAINT "finance_plan_confirmations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plan_confirmations" ADD CONSTRAINT "finance_plan_confirmations_plan_id_finance_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."finance_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plan_debt_confirmations" ADD CONSTRAINT "finance_plan_debt_confirmations_debt_id_finance_plan_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."finance_plan_debts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plan_snapshot_debts" ADD CONSTRAINT "finance_plan_snapshot_debts_debt_id_finance_plan_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."finance_plan_debts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plan_snapshots" ADD CONSTRAINT "finance_plan_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plan_snapshots" ADD CONSTRAINT "finance_plan_snapshots_plan_id_finance_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."finance_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- History becomes the user's: rows the main plan wrote are theirs; what a
-- what-if plan recorded was never real and goes.
UPDATE "finance_plan_snapshots" s SET "user_id" = p."user_id"
  FROM "finance_plans" p WHERE p."id" = s."plan_id" AND p."is_main";--> statement-breakpoint
DELETE FROM "finance_plan_snapshots" s
  USING "finance_plans" p WHERE p."id" = s."plan_id" AND NOT p."is_main";--> statement-breakpoint
UPDATE "finance_plan_confirmations" c SET "user_id" = p."user_id"
  FROM "finance_plans" p WHERE p."id" = c."plan_id" AND p."is_main";--> statement-breakpoint
-- Every balance on record names its debt by key; a debt's key is its own id
-- until it is copied.
UPDATE "finance_plan_snapshot_debts" SET "debt_key" = "debt_id";--> statement-breakpoint
UPDATE "finance_plan_debt_confirmations" SET "debt_key" = "debt_id";--> statement-breakpoint
CREATE UNIQUE INDEX "finance_plan_confirmations_user_month_uniq" ON "finance_plan_confirmations" USING btree ("user_id","confirmation_month");--> statement-breakpoint
CREATE INDEX "finance_plan_snapshots_user_date_idx" ON "finance_plan_snapshots" USING btree ("user_id","date");