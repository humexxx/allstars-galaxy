ALTER TABLE "trip_items" ADD COLUMN "from_code" text;--> statement-breakpoint
ALTER TABLE "trip_items" ADD COLUMN "to_code" text;--> statement-breakpoint
ALTER TABLE "trip_items" ADD COLUMN "price_max" numeric(20, 2);