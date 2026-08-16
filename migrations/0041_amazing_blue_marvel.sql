ALTER TABLE "trip_photos" ADD COLUMN "item_id" uuid;--> statement-breakpoint
ALTER TABLE "trip_shares" ADD COLUMN "show_prices" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_shares" ADD COLUMN "show_members" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_photos" ADD CONSTRAINT "trip_photos_item_id_trip_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."trip_items"("id") ON DELETE cascade ON UPDATE no action;