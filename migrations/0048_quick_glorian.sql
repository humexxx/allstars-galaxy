CREATE TABLE "f1_news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" text NOT NULL,
	"headline" text NOT NULL,
	"description" text,
	"link" text,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "f1_news_article_id_uniq" ON "f1_news" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "f1_news_first_seen_at_idx" ON "f1_news" USING btree ("first_seen_at");