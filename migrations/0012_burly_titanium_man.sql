CREATE INDEX IF NOT EXISTS "board_columns_user_id_idx" ON "board_columns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_tasks_user_id_idx" ON "board_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_tasks_column_id_idx" ON "board_tasks" USING btree ("column_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_tasks_road_path_id_idx" ON "board_tasks" USING btree ("road_path_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "portfolio_snapshots_portfolio_id_idx" ON "portfolio_snapshots" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "portfolio_snapshots_date_idx" ON "portfolio_snapshots" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "road_path_milestones_road_path_id_idx" ON "road_path_milestones" USING btree ("road_path_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "road_path_progress_road_path_id_idx" ON "road_path_progress" USING btree ("road_path_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "road_path_progress_date_idx" ON "road_path_progress" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "road_paths_user_id_idx" ON "road_paths" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_portfolio_id_idx" ON "transactions" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_investment_method_id_idx" ON "transactions" USING btree ("investment_method_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_status_idx" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_date_idx" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_approved_by_idx" ON "transactions" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_rejected_by_idx" ON "transactions" USING btree ("rejected_by");
