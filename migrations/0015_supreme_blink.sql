CREATE TABLE "finance_plan_debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"initial_balance" numeric(20, 2) DEFAULT '0' NOT NULL,
	"monthly_interest_rate" numeric(9, 6) DEFAULT '0' NOT NULL,
	"monthly_payment" numeric(20, 2) DEFAULT '0' NOT NULL,
	"sort_order" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_plan_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"monthly_amount" numeric(20, 2) DEFAULT '0' NOT NULL,
	"sort_order" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_plan_incomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"monthly_amount" numeric(20, 2) DEFAULT '0' NOT NULL,
	"sort_order" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"start_month" timestamp with time zone NOT NULL,
	"months_ahead" real DEFAULT 24 NOT NULL,
	"initial_savings" numeric(20, 2) DEFAULT '0' NOT NULL,
	"monthly_savings_rate" numeric(9, 6) DEFAULT '0' NOT NULL,
	"include_portfolio" boolean DEFAULT false NOT NULL,
	"color" text DEFAULT 'var(--chart-1)' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ADD CONSTRAINT "finance_plan_debts_plan_id_finance_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."finance_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plan_expenses" ADD CONSTRAINT "finance_plan_expenses_plan_id_finance_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."finance_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plan_incomes" ADD CONSTRAINT "finance_plan_incomes_plan_id_finance_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."finance_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_plan_debts_plan_id_idx" ON "finance_plan_debts" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "finance_plan_expenses_plan_id_idx" ON "finance_plan_expenses" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "finance_plan_incomes_plan_id_idx" ON "finance_plan_incomes" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "finance_plans_user_id_idx" ON "finance_plans" USING btree ("user_id");