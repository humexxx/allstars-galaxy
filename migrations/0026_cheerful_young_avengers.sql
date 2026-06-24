CREATE TYPE "public"."finance_confirmation_source" AS ENUM('user', 'auto');--> statement-breakpoint
CREATE TABLE "finance_plan_snapshot_debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"debt_id" uuid NOT NULL,
	"balance" numeric(20, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_plan_confirmations" ADD COLUMN "source" "finance_confirmation_source" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plan_snapshot_debts" ADD CONSTRAINT "finance_plan_snapshot_debts_snapshot_id_finance_plan_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."finance_plan_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plan_snapshot_debts" ADD CONSTRAINT "finance_plan_snapshot_debts_debt_id_finance_plan_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."finance_plan_debts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "finance_plan_snapshot_debts_uniq" ON "finance_plan_snapshot_debts" USING btree ("snapshot_id","debt_id");--> statement-breakpoint
CREATE INDEX "finance_plan_snapshot_debts_debt_id_idx" ON "finance_plan_snapshot_debts" USING btree ("debt_id");