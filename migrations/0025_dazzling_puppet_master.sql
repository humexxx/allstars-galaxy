ALTER TABLE "finance_plans" ADD COLUMN "is_main" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "finance_plans_user_main_uniq" ON "finance_plans" USING btree ("user_id") WHERE "finance_plans"."is_main" = TRUE;--> statement-breakpoint
-- Backfill: mark each existing user's oldest plan as their main plan, so the
-- partial unique index has rows to enforce and the dashboard immediately
-- knows which plan to follow. DISTINCT ON keeps exactly one row per user.
WITH first_plans AS (
  SELECT DISTINCT ON (user_id) id
  FROM finance_plans
  ORDER BY user_id, created_at ASC
)
UPDATE finance_plans
SET is_main = TRUE
WHERE id IN (SELECT id FROM first_plans);