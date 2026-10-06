CREATE TYPE "public"."achievement_source" AS ENUM('fsp_registry', 'organizer', 'repo', 'self');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('sent', 'viewed', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."attempt_event" AS ENUM('visibility_hidden', 'blur', 'copy', 'paste', 'fullscreen_exit', 'fullscreen_enter', 'bulk_insert', 'context_menu', 'devtools');--> statement-breakpoint
CREATE TYPE "public"."attempt_result" AS ENUM('passed_confident', 'passed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'finished', 'expired', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."category_status" AS ENUM('active', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."consent_kind" AS ENUM('pd_processing', 'privacy_policy', 'marketing');--> statement-breakpoint
CREATE TYPE "public"."fsp_stage" AS ENUM('regional', 'district', 'final');--> statement-breakpoint
CREATE TYPE "public"."grade" AS ENUM('junior', 'middle', 'senior');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('sent', 'viewed', 'accepted', 'declined', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."parse_status" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."parsed_by" AS ENUM('llm', 'form', 'rules');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('candidate', 'employer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."skill_source" AS ENUM('declared', 'resume', 'test_confirmed');--> statement-breakpoint
CREATE TYPE "public"."specialization" AS ENUM('backend', 'frontend', 'data', 'qa', 'mobile', 'devops', 'analyst');--> statement-breakpoint
CREATE TYPE "public"."task_kind" AS ENUM('code', 'sql', 'quiz', 'calc');--> statement-breakpoint
CREATE TYPE "public"."template_status" AS ENUM('active', 'flagged', 'retired');--> statement-breakpoint
CREATE TYPE "public"."token_kind" AS ENUM('verify_email', 'reset_password');--> statement-breakpoint
CREATE TYPE "public"."trust_level" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."vacancy_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."verified_status" AS ENUM('unverified', 'pending', 'verified');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('visible', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."work_format" AS ENUM('office', 'hybrid', 'remote');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"cover_letter" text,
	"status" "application_status" DEFAULT 'sent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempt_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"item_id" uuid,
	"type" "attempt_event" NOT NULL,
	"payload" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"template_id" text NOT NULL,
	"seed" text NOT NULL,
	"rendered_hash" text NOT NULL,
	"marker" text NOT NULL,
	"traps" jsonb,
	"served_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden_nonce" text,
	"hidden_issued_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	"answer" jsonb,
	"code" text,
	"is_correct" boolean,
	"partial_score" real,
	"time_ms" integer,
	"theta_after" real,
	"se_after" real,
	"trap_hits" jsonb
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"meta" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_contacts" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" text DEFAULT '' NOT NULL,
	"city" text,
	"about" text,
	"experience_years" real,
	"salary_expect_from" integer,
	"salary_expect_to" integer,
	"work_format" "work_format",
	"visibility" "visibility" DEFAULT 'visible' NOT NULL,
	"fsp_id" text,
	"survey" jsonb,
	"onboarded_at" timestamp with time zone,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "candidate_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"skill" text NOT NULL,
	"source" "skill_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"specialization" "specialization" NOT NULL,
	"grade" "grade" NOT NULL,
	"score" real NOT NULL,
	"theta" real NOT NULL,
	"se" real NOT NULL,
	"trust_level" "trust_level" DEFAULT 'high' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt_id" uuid,
	"status" "category_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"title" text,
	"event_date" text,
	"meta" jsonb,
	"checks" jsonb,
	"trust_level" "trust_level" DEFAULT 'low' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "consent_kind" NOT NULL,
	"version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "token_kind" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"model" text NOT NULL,
	"text_hash" text NOT NULL,
	"vector" real[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"inn" text,
	"about" text,
	"site" text,
	"city" text,
	"verified_status" "verified_status" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "fsp_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"competition" text NOT NULL,
	"discipline" text NOT NULL,
	"stage" "fsp_stage" NOT NULL,
	"year" integer NOT NULL,
	"place" integer,
	"rank" integer,
	"sports_category" text,
	"source" "achievement_source" NOT NULL,
	"trust_level" "trust_level" NOT NULL,
	"evidence" jsonb,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_links" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"verified_via_oauth" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"from_status" "invitation_status",
	"to_status" "invitation_status" NOT NULL,
	"actor_user_id" uuid,
	"note" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"need_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"salary_from" integer NOT NULL,
	"salary_to" integer NOT NULL,
	"format" "work_format",
	"status" "invitation_status" DEFAULT 'sent' NOT NULL,
	"decline_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"viewed_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "needs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"raw_text" text,
	"specialization" "specialization" NOT NULL,
	"grade" "grade" NOT NULL,
	"stack" text[] DEFAULT '{}'::text[] NOT NULL,
	"salary_from" integer NOT NULL,
	"salary_to" integer NOT NULL,
	"format" "work_format",
	"city" text,
	"team_about" text,
	"parsed_by" "parsed_by" DEFAULT 'form' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"parsed_json" jsonb,
	"parse_status" "parse_status" DEFAULT 'pending' NOT NULL,
	"parsed_by" "parsed_by",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"need_id" uuid,
	"base_snapshot" jsonb NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"query" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shortlist" (
	"employer_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shortlist_employer_id_profile_id_pk" PRIMARY KEY("employer_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"specialization" "specialization" NOT NULL,
	"kind" "task_kind" NOT NULL,
	"language" text,
	"title" text NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"difficulty_b" real NOT NULL,
	"discrimination_a" real NOT NULL,
	"params_schema" jsonb,
	"generator_ref" text NOT NULL,
	"status" "template_status" DEFAULT 'active' NOT NULL,
	"exposure_count" integer DEFAULT 0 NOT NULL,
	"answered_count" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"expected_correct" real DEFAULT 0 NOT NULL,
	"flagged_at" timestamp with time zone,
	"flag_reason" text,
	"calibrated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "test_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"specialization" "specialization" NOT NULL,
	"target_grade" "grade" NOT NULL,
	"status" "attempt_status" DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"theta" real,
	"se" real,
	"score" real,
	"result" "attempt_result",
	"trust_index" real,
	"trust_level" "trust_level",
	"trust_signals" jsonb,
	"seed" text NOT NULL,
	"marker" text NOT NULL,
	"reviewed_at" timestamp with time zone,
	"review_note" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" "role" NOT NULL,
	"email_verified_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vacancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"specialization" "specialization" NOT NULL,
	"grade" "grade" NOT NULL,
	"stack" text[] DEFAULT '{}'::text[] NOT NULL,
	"salary_from" integer NOT NULL,
	"salary_to" integer NOT NULL,
	"format" "work_format",
	"city" text,
	"status" "vacancy_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_events" ADD CONSTRAINT "attempt_events_attempt_id_test_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."test_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_items" ADD CONSTRAINT "attempt_items_attempt_id_test_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."test_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_items" ADD CONSTRAINT "attempt_items_template_id_task_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."task_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_contacts" ADD CONSTRAINT "candidate_contacts_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employers" ADD CONSTRAINT "employers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fsp_achievements" ADD CONSTRAINT "fsp_achievements_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_links" ADD CONSTRAINT "github_links_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_events" ADD CONSTRAINT "invitation_events_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "needs" ADD CONSTRAINT "needs_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "searches" ADD CONSTRAINT "searches_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "searches" ADD CONSTRAINT "searches_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlist" ADD CONSTRAINT "shortlist_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlist" ADD CONSTRAINT "shortlist_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_profile_id_candidate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applications_uniq" ON "applications" USING btree ("vacancy_id","profile_id");--> statement-breakpoint
CREATE INDEX "attempt_events_attempt_idx" ON "attempt_events" USING btree ("attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_items_pos_uniq" ON "attempt_items" USING btree ("attempt_id","position");--> statement-breakpoint
CREATE INDEX "attempt_items_template_idx" ON "attempt_items" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "candidate_profiles_visibility_idx" ON "candidate_profiles" USING btree ("visibility");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_skills_uniq" ON "candidate_skills" USING btree ("profile_id","skill","source");--> statement-breakpoint
CREATE INDEX "candidate_skills_skill_idx" ON "candidate_skills" USING btree ("skill");--> statement-breakpoint
CREATE INDEX "categories_lookup_idx" ON "categories" USING btree ("specialization","grade","status");--> statement-breakpoint
CREATE INDEX "categories_profile_idx" ON "categories" USING btree ("profile_id","status");--> statement-breakpoint
CREATE INDEX "consents_user_idx" ON "consents" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "email_tokens_user_idx" ON "email_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "embeddings_owner_uniq" ON "embeddings" USING btree ("owner_type","owner_id","model");--> statement-breakpoint
CREATE INDEX "fsp_achievements_profile_idx" ON "fsp_achievements" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fsp_achievements_ext_uniq" ON "fsp_achievements" USING btree ("profile_id","external_id");--> statement-breakpoint
CREATE INDEX "invitation_events_inv_idx" ON "invitation_events" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "invitations_employer_idx" ON "invitations" USING btree ("employer_id","created_at");--> statement-breakpoint
CREATE INDEX "invitations_profile_idx" ON "invitations" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "needs_employer_idx" ON "needs" USING btree ("employer_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "searches_employer_idx" ON "searches" USING btree ("employer_id","created_at");--> statement-breakpoint
CREATE INDEX "task_templates_spec_idx" ON "task_templates" USING btree ("specialization","status");--> statement-breakpoint
CREATE INDEX "test_attempts_profile_idx" ON "test_attempts" USING btree ("profile_id","specialization","target_grade");--> statement-breakpoint
CREATE INDEX "test_attempts_status_idx" ON "test_attempts" USING btree ("status","trust_level");--> statement-breakpoint
CREATE INDEX "vacancies_lookup_idx" ON "vacancies" USING btree ("status","specialization","grade");