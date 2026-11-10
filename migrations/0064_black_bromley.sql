CREATE TYPE "public"."trading_cash_kind" AS ENUM('deposit', 'withdrawal');--> statement-breakpoint
CREATE TYPE "public"."trading_side" AS ENUM('long', 'short');--> statement-breakpoint
CREATE TABLE "trading_cash_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "trading_cash_kind" NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trading_cash_movements_amount_chk" CHECK ("trading_cash_movements"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "trading_cash_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trading_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"side" "trading_side" DEFAULT 'long' NOT NULL,
	"quantity" numeric(20, 8) NOT NULL,
	"multiplier" numeric(20, 8) DEFAULT '1' NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"exit_price" numeric(20, 8),
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"fees" numeric(20, 2) DEFAULT '0' NOT NULL,
	"setup" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trading_trades_quantity_chk" CHECK ("trading_trades"."quantity" > 0),
	CONSTRAINT "trading_trades_multiplier_chk" CHECK ("trading_trades"."multiplier" > 0),
	CONSTRAINT "trading_trades_prices_chk" CHECK ("trading_trades"."entry_price" >= 0 AND ("trading_trades"."exit_price" IS NULL OR "trading_trades"."exit_price" >= 0)),
	CONSTRAINT "trading_trades_fees_chk" CHECK ("trading_trades"."fees" >= 0),
	CONSTRAINT "trading_trades_close_chk" CHECK (("trading_trades"."exit_price" IS NULL) = ("trading_trades"."closed_at" IS NULL)),
	CONSTRAINT "trading_trades_order_chk" CHECK ("trading_trades"."closed_at" IS NULL OR "trading_trades"."closed_at" >= "trading_trades"."opened_at")
);
--> statement-breakpoint
ALTER TABLE "trading_trades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trading_cash_movements" ADD CONSTRAINT "trading_cash_movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_trades" ADD CONSTRAINT "trading_trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trading_cash_movements_user_occurred_idx" ON "trading_cash_movements" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "trading_trades_user_opened_idx" ON "trading_trades" USING btree ("user_id","opened_at");