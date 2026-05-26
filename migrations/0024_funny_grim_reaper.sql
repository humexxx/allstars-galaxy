CREATE TYPE "public"."finance_plan_override_action" AS ENUM('skip', 'reschedule', 'amount');--> statement-breakpoint
CREATE TYPE "public"."finance_plan_override_side" AS ENUM('income', 'expense', 'debt');--> statement-breakpoint
CREATE TABLE "finance_plan_line_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"parent_side" "finance_plan_override_side" NOT NULL,
	"parent_id" uuid NOT NULL,
	"month_year" date NOT NULL,
	"action" "finance_plan_override_action" NOT NULL,
	"date" date,
	"monthly_amount" numeric(20, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_plan_line_overrides_reschedule_chk" CHECK (("finance_plan_line_overrides"."action" <> 'reschedule') OR ("finance_plan_line_overrides"."date" IS NOT NULL)),
	CONSTRAINT "finance_plan_line_overrides_amount_chk" CHECK (("finance_plan_line_overrides"."action" <> 'amount') OR ("finance_plan_line_overrides"."monthly_amount" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "finance_plan_line_overrides" ADD CONSTRAINT "finance_plan_line_overrides_plan_id_finance_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."finance_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_plan_line_overrides_plan_id_idx" ON "finance_plan_line_overrides" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_plan_line_overrides_parent_month_uniq" ON "finance_plan_line_overrides" USING btree ("parent_side","parent_id","month_year");