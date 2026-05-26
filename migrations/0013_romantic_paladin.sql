-- monthly_roi: real (32-bit float) -> numeric(7,4) for financial precision.
-- The real -> numeric cast is well-defined in Postgres; USING is added to be explicit.
ALTER TABLE "investment_methods"
  ALTER COLUMN "monthly_roi" SET DATA TYPE numeric(7, 4)
  USING ("monthly_roi"::numeric(7, 4));--> statement-breakpoint

-- auto_create_tasks: real (0/1) -> boolean. Drops the old "real" default first so we can
-- rebuild the column type, then sets the proper boolean default.
ALTER TABLE "road_paths" ALTER COLUMN "auto_create_tasks" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "road_paths"
  ALTER COLUMN "auto_create_tasks" SET DATA TYPE boolean
  USING ("auto_create_tasks" <> 0);--> statement-breakpoint
ALTER TABLE "road_paths" ALTER COLUMN "auto_create_tasks" SET DEFAULT false;--> statement-breakpoint

-- users.updated_at: backfill any NULLs to NOW() once so the new default applies on inserts
-- and existing rows still have a value.
UPDATE "users" SET "updated_at" = now() WHERE "updated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT now();
