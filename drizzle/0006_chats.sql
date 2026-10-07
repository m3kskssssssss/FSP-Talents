CREATE TYPE "public"."chat_author" AS ENUM('employer', 'candidate', 'system');--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"author" "chat_author" NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"title" text NOT NULL,
	"employer_read_at" timestamp with time zone,
	"candidate_read_at" timestamp with time zone,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_chat_idx" ON "chat_messages" USING btree ("chat_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chats_pair_uniq" ON "chats" USING btree ("employer_id","profile_id");--> statement-breakpoint
CREATE INDEX "chats_profile_idx" ON "chats" USING btree ("profile_id","last_message_at");