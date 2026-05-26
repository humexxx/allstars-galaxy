CREATE TABLE "user_sports_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sport_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_sports_preferences" ADD CONSTRAINT "user_sports_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_sports_preferences_user_sport_uniq" ON "user_sports_preferences" USING btree ("user_id","sport_id");--> statement-breakpoint
CREATE INDEX "user_sports_preferences_user_id_idx" ON "user_sports_preferences" USING btree ("user_id");