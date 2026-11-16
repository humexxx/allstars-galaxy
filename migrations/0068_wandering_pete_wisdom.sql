CREATE TABLE "trading_balance_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trading_balance_adjustments_amount_chk" CHECK ("trading_balance_adjustments"."amount" <> 0)
);
--> statement-breakpoint
ALTER TABLE "trading_balance_adjustments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trading_balance_adjustments" ADD CONSTRAINT "trading_balance_adjustments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trading_balance_adjustments_user_occurred_idx" ON "trading_balance_adjustments" USING btree ("user_id","occurred_at");