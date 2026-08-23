-- Fails fast instead of hanging on a spinner if the dev server is mid-query:
-- adding a foreign key needs AccessExclusiveLock on both tables.
SET lock_timeout = '30s';--> statement-breakpoint
ALTER TABLE "trip_shares" ADD COLUMN "member_id" uuid;--> statement-breakpoint
ALTER TABLE "trip_shares" ADD CONSTRAINT "trip_shares_member_id_trip_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."trip_members"("id") ON DELETE set null ON UPDATE no action;