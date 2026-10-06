CREATE TYPE "public"."attempt_mode" AS ENUM('full', 'express');--> statement-breakpoint
ALTER TABLE "test_attempts" ADD COLUMN "mode" "attempt_mode" DEFAULT 'full' NOT NULL;