CREATE TYPE "public"."debt_payment_type" AS ENUM('fixed', 'percent_of_balance');--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ADD COLUMN "payment_type" "debt_payment_type" DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ADD COLUMN "min_payment_percent" numeric(5, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ADD COLUMN "min_payment_floor" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plans" ADD COLUMN "auto_invest_percent" numeric(5, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plans" ADD COLUMN "auto_invest_method_id" uuid;--> statement-breakpoint
ALTER TABLE "finance_plans" ADD COLUMN "initial_investments" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_methods" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_auto_invest_method_id_investment_methods_id_fk" FOREIGN KEY ("auto_invest_method_id") REFERENCES "public"."investment_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Seed a higher-yield method that exists as a hypothetical scenario for finance
-- plans but is disabled in the portfolio (cannot be used for real transactions).
INSERT INTO "investment_methods" ("name", "description", "author", "risk_level", "monthly_roi", "enabled")
SELECT 'Aggressive Growth',
       'High-yield hypothetical track at 1.5% monthly. Disabled in portfolio: available only for finance plan scenarios.',
       'Humexxx',
       'High',
       '1.5000',
       false
WHERE NOT EXISTS (
  SELECT 1 FROM "investment_methods" WHERE "name" = 'Aggressive Growth'
);