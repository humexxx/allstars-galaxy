CREATE TABLE "trip_item_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"member_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_item_attendees" ADD CONSTRAINT "trip_item_attendees_item_id_trip_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."trip_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_item_attendees" ADD CONSTRAINT "trip_item_attendees_member_id_trip_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."trip_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_item_attendees_item_id_idx" ON "trip_item_attendees" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_item_attendees_item_member_uq" ON "trip_item_attendees" USING btree ("item_id","member_id");