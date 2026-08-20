ALTER TYPE "public"."trip_item_category" ADD VALUE 'flight' BEFORE 'transport';--> statement-breakpoint
ALTER TYPE "public"."trip_item_category" ADD VALUE 'cruise' BEFORE 'transport';--> statement-breakpoint
CREATE TABLE "trip_item_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"day_number" integer NOT NULL,
	"stop_on" date,
	"place" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_item_stops" ADD CONSTRAINT "trip_item_stops_item_id_trip_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."trip_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_item_stops_item_id_idx" ON "trip_item_stops" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_item_stops_item_day_uq" ON "trip_item_stops" USING btree ("item_id","day_number");