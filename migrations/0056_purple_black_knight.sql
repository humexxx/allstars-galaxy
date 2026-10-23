CREATE TABLE "road_path_check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"road_path_id" uuid NOT NULL,
	"day" date NOT NULL,
	"task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "road_path_check_ins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "board_columns" ADD COLUMN "is_done" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "board_tasks" ADD COLUMN "board_date" date DEFAULT CURRENT_DATE NOT NULL;--> statement-breakpoint
ALTER TABLE "board_tasks" ADD COLUMN "carry_over_declined_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "road_paths" ADD COLUMN "schedule_days" integer[];--> statement-breakpoint
ALTER TABLE "road_paths" ADD COLUMN "schedule_since" date;--> statement-breakpoint
ALTER TABLE "road_path_check_ins" ADD CONSTRAINT "road_path_check_ins_road_path_id_road_paths_id_fk" FOREIGN KEY ("road_path_id") REFERENCES "public"."road_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "road_path_check_ins" ADD CONSTRAINT "road_path_check_ins_task_id_board_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."board_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Every board had a "Done" column by name; it becomes the flagged one (one per board).
UPDATE "board_columns" SET "is_done" = true WHERE "id" IN (
  SELECT DISTINCT ON ("user_id") "id" FROM "board_columns"
  WHERE "name" ~* '\m(done|completed?|finished|closed|shipped)\M'
  ORDER BY "user_id", "order" DESC
);--> statement-breakpoint
-- Existing tasks go on the board of the day they were written.
UPDATE "board_tasks" SET "board_date" = ("created_at" AT TIME ZONE 'UTC')::date WHERE "created_at" IS NOT NULL;--> statement-breakpoint
-- A task already sitting in Done was finished; nothing recorded when.
UPDATE "board_tasks" SET "completed_at" = COALESCE("updated_at", now())
WHERE "completed_at" IS NULL AND "column_id" IN (SELECT "id" FROM "board_columns" WHERE "is_done");--> statement-breakpoint
CREATE UNIQUE INDEX "road_path_check_ins_path_day_uq" ON "road_path_check_ins" USING btree ("road_path_id","day");--> statement-breakpoint
CREATE INDEX "road_path_check_ins_task_id_idx" ON "road_path_check_ins" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "board_columns_user_done_uq" ON "board_columns" USING btree ("user_id") WHERE "board_columns"."is_done";--> statement-breakpoint
CREATE INDEX "board_tasks_user_board_date_idx" ON "board_tasks" USING btree ("user_id","board_date");--> statement-breakpoint
CREATE UNIQUE INDEX "board_tasks_road_path_day_uq" ON "board_tasks" USING btree ("road_path_id","board_date") WHERE "board_tasks"."road_path_id" IS NOT NULL;