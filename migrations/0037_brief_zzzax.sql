-- The video belongs to the activity, not the trip.
--
-- A trip is a container; it is the individual thing — the cruise, the hotel,
-- the park — that has a walkthrough worth watching. Added at trip level one
-- migration ago and moved here before any row used it.
ALTER TABLE "trip_items" ADD COLUMN "youtube_url" text;--> statement-breakpoint
ALTER TABLE "trips" DROP COLUMN IF EXISTS "youtube_url";
