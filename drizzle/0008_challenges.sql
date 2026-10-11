CREATE TYPE "public"."assignment_status" AS ENUM('offered', 'submitted', 'graded', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."challenge_kind" AS ENUM('exact', 'open');--> statement-breakpoint
CREATE TYPE "public"."challenge_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TABLE "challenge_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"status" "assignment_status" DEFAULT 'offered' NOT NULL,
	"answer" text,
	"score" integer,
	"feedback" text,
	"offered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"graded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"statement" text NOT NULL,
	"specialization" "specialization" NOT NULL,
	"grade" "grade",
	"kind" "challenge_kind" NOT NULL,
	"expected_answer" text,
	"status" "challenge_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenge_assignments" ADD CONSTRAINT "challenge_assignments_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_assignments" ADD CONSTRAINT "challenge_assignments_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_assignments_once" ON "challenge_assignments" USING btree ("challenge_id","profile_id");--> statement-breakpoint
CREATE INDEX "challenge_assignments_profile_idx" ON "challenge_assignments" USING btree ("profile_id","offered_at");--> statement-breakpoint
CREATE INDEX "challenges_lookup_idx" ON "challenges" USING btree ("status","specialization");--> statement-breakpoint
CREATE INDEX "challenges_employer_idx" ON "challenges" USING btree ("employer_id","created_at");