CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
ALTER TABLE "board_tasks" ADD COLUMN "priority" "task_priority";