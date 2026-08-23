CREATE TYPE "public"."trip_price_unit" AS ENUM('total', 'per_night', 'per_person');--> statement-breakpoint
ALTER TABLE "trip_items" ADD COLUMN "price_unit" "trip_price_unit" DEFAULT 'total' NOT NULL;