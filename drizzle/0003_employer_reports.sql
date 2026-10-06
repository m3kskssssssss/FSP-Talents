CREATE TYPE "public"."report_reason" AS ENUM('fake_vacancy', 'salary_mismatch', 'spam', 'inappropriate', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'confirmed', 'dismissed');--> statement-breakpoint
CREATE TABLE "employer_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"invitation_id" uuid,
	"reporter_profile_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"note" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution_note" text
);
--> statement-breakpoint
ALTER TABLE "employer_reports" ADD CONSTRAINT "employer_reports_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_reports" ADD CONSTRAINT "employer_reports_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_reports" ADD CONSTRAINT "employer_reports_reporter_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("reporter_profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employer_reports_employer_idx" ON "employer_reports" USING btree ("employer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "employer_reports_once_idx" ON "employer_reports" USING btree ("invitation_id","reporter_profile_id");