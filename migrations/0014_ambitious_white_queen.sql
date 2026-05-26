CREATE TABLE "impersonation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"impersonated_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_table" text,
	"entity_id" uuid,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "impersonation_logs" ADD CONSTRAINT "impersonation_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonation_logs" ADD CONSTRAINT "impersonation_logs_impersonated_user_id_users_id_fk" FOREIGN KEY ("impersonated_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "impersonation_logs_admin_id_idx" ON "impersonation_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "impersonation_logs_impersonated_user_id_idx" ON "impersonation_logs" USING btree ("impersonated_user_id");--> statement-breakpoint
CREATE INDEX "impersonation_logs_created_at_idx" ON "impersonation_logs" USING btree ("created_at");