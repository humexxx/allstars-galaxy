CREATE TABLE "trip_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"note" text,
	"paid_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_contributions_amount_chk" CHECK ("trip_contributions"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "trip_item_payers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"share_percent" numeric(6, 3)
);
--> statement-breakpoint
CREATE TABLE "trip_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"share_percent" numeric(6, 3),
	"sort_order" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_members_share_chk" CHECK ("trip_members"."share_percent" IS NULL OR ("trip_members"."share_percent" >= 0 AND "trip_members"."share_percent" <= 100))
);
--> statement-breakpoint
ALTER TABLE "trip_items" ADD COLUMN "ends_on" date;--> statement-breakpoint
ALTER TABLE "trip_contributions" ADD CONSTRAINT "trip_contributions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_contributions" ADD CONSTRAINT "trip_contributions_member_id_trip_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."trip_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_item_payers" ADD CONSTRAINT "trip_item_payers_item_id_trip_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."trip_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_item_payers" ADD CONSTRAINT "trip_item_payers_member_id_trip_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."trip_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_contributions_trip_id_idx" ON "trip_contributions" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_item_payers_item_id_idx" ON "trip_item_payers" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_item_payers_item_member_uq" ON "trip_item_payers" USING btree ("item_id","member_id");--> statement-breakpoint
CREATE INDEX "trip_members_trip_id_idx" ON "trip_members" USING btree ("trip_id");