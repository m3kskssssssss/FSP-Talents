CREATE TYPE "public"."interview_status" AS ENUM('scheduled', 'cancelled', 'done');--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"status" "interview_status" DEFAULT 'scheduled' NOT NULL,
	"task" text,
	"language" text DEFAULT 'python' NOT NULL,
	"code" text DEFAULT '' NOT NULL,
	"rating" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interviews_chat_idx" ON "interviews" USING btree ("chat_id","scheduled_at");