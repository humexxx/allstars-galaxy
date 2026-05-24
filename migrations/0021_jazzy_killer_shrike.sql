CREATE TYPE "public"."trip_item_category" AS ENUM('lodging', 'transport', 'food', 'activity', 'shopping', 'other');--> statement-breakpoint
CREATE TYPE "public"."trip_photo_source" AS ENUM('upload', 'url');--> statement-breakpoint
CREATE TABLE "trip_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" "trip_item_category" DEFAULT 'activity' NOT NULL,
	"link" text,
	"price" numeric(20, 2),
	"scheduled_on" date,
	"notes" text,
	"sort_order" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_items_price_chk" CHECK ("trip_items"."price" IS NULL OR "trip_items"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "trip_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"url" text NOT NULL,
	"storage_path" text,
	"source" "trip_photo_source" DEFAULT 'url' NOT NULL,
	"caption" text,
	"sort_order" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"token" text NOT NULL,
	"invitee_email" text,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"destination" text,
	"description" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"cover_photo_url" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"color" text DEFAULT 'var(--chart-1)' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_date_range_chk" CHECK ("trips"."end_date" IS NULL OR "trips"."end_date" >= "trips"."start_date")
);
--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ADD COLUMN "day_of_month" integer;--> statement-breakpoint
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_photos" ADD CONSTRAINT "trip_photos_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_shares" ADD CONSTRAINT "trip_shares_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_items_trip_id_idx" ON "trip_items" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_items_scheduled_on_idx" ON "trip_items" USING btree ("scheduled_on");--> statement-breakpoint
CREATE INDEX "trip_photos_trip_id_idx" ON "trip_photos" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_shares_token_uniq" ON "trip_shares" USING btree ("token");--> statement-breakpoint
CREATE INDEX "trip_shares_trip_id_idx" ON "trip_shares" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trips_user_id_idx" ON "trips" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trips_start_date_idx" ON "trips" USING btree ("start_date");--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ADD CONSTRAINT "finance_plan_debts_day_of_month_chk" CHECK ("finance_plan_debts"."day_of_month" IS NULL OR ("finance_plan_debts"."day_of_month" >= 1 AND "finance_plan_debts"."day_of_month" <= 31));