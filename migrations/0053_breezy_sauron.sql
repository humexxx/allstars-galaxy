-- Close the Supabase Data API (REST and GraphQL) over every public table.
--   * RLS on, with no policies: the anon and authenticated roles that the
--     publishable key maps to can no longer read or write any row. The app is
--     unaffected — Drizzle connects as `postgres`, the tables' owner (and
--     BYPASSRLS), and public.handle_new_user is SECURITY DEFINER owned by it.
--   * The table grants those two roles held go as well, and so do the default
--     privileges that would hand the same grants to tables created later.
ALTER TABLE "app_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "board_columns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "board_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "f1_news" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_plan_confirmations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_plan_debt_confirmations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_plan_debts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_plan_expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_plan_incomes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_plan_line_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_plan_snapshot_debts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_plan_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "impersonation_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "investment_methods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "method_allocations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "portfolios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "price_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "price_quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "road_path_milestones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "road_path_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "road_paths" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transaction_allocations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trip_contributions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trip_item_attendees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trip_item_payers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trip_item_stops" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trip_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trip_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trip_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trip_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_sports_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
