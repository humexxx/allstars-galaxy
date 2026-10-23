CREATE TABLE "user_sports_team_filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sport_id" text NOT NULL,
	"competition" text NOT NULL,
	"team_ids" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_sports_team_filters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_sports_team_filters" ADD CONSTRAINT "user_sports_team_filters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_sports_team_filters_user_list_uniq" ON "user_sports_team_filters" USING btree ("user_id","sport_id","competition");