CREATE TABLE "method_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"method_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"percent" numeric(6, 3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"price_at_purchase" numeric(24, 8) NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"priced_on" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "method_allocations" ADD CONSTRAINT "method_allocations_method_id_investment_methods_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."investment_methods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "method_allocations" ADD CONSTRAINT "method_allocations_asset_id_price_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."price_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_allocations" ADD CONSTRAINT "transaction_allocations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_allocations" ADD CONSTRAINT "transaction_allocations_asset_id_price_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."price_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "method_allocations_method_id_idx" ON "method_allocations" USING btree ("method_id");--> statement-breakpoint
CREATE UNIQUE INDEX "method_allocations_method_asset_uq" ON "method_allocations" USING btree ("method_id","asset_id");--> statement-breakpoint
CREATE INDEX "transaction_allocations_transaction_id_idx" ON "transaction_allocations" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "transaction_allocations_asset_id_idx" ON "transaction_allocations" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_allocations_tx_asset_uq" ON "transaction_allocations" USING btree ("transaction_id","asset_id");