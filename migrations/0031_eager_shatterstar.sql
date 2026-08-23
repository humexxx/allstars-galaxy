CREATE TABLE "method_holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"method_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"cost_basis" numeric(20, 2) DEFAULT '0' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"external_id" text,
	"source" text DEFAULT 'coingecko' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_assets_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "price_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"price" numeric(24, 8) NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "method_holdings" ADD CONSTRAINT "method_holdings_method_id_investment_methods_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."investment_methods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "method_holdings" ADD CONSTRAINT "method_holdings_asset_id_price_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."price_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_quotes" ADD CONSTRAINT "price_quotes_asset_id_price_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."price_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "method_holdings_method_id_idx" ON "method_holdings" USING btree ("method_id");--> statement-breakpoint
CREATE UNIQUE INDEX "method_holdings_method_asset_uq" ON "method_holdings" USING btree ("method_id","asset_id");--> statement-breakpoint
CREATE INDEX "price_quotes_asset_id_idx" ON "price_quotes" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "price_quotes_fetched_at_idx" ON "price_quotes" USING btree ("fetched_at");