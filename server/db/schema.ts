import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const roleEnum = pgEnum("role", ["candidate", "employer", "admin"]);
export const consentKindEnum = pgEnum("consent_kind", ["pd_processing", "privacy_policy", "marketing"]);
export const specializationEnum = pgEnum("specialization", [
  "backend",
  "frontend",
  "data",
  "qa",
  "mobile",
  "devops",
  "analyst",
]);
export const gradeEnum = pgEnum("grade", ["junior", "middle", "senior"]);
export const workFormatEnum = pgEnum("work_format", ["office", "hybrid", "remote"]);
export const visibilityEnum = pgEnum("visibility", ["visible", "hidden"]);
export const skillSourceEnum = pgEnum("skill_source", ["declared", "resume", "test_confirmed"]);
export const parseStatusEnum = pgEnum("parse_status", ["pending", "done", "failed"]);
export const categoryStatusEnum = pgEnum("category_status", ["active", "superseded"]);
export const taskKindEnum = pgEnum("task_kind", ["code", "sql", "quiz", "calc"]);
export const templateStatusEnum = pgEnum("template_status", ["active", "flagged", "retired"]);
export const attemptStatusEnum = pgEnum("attempt_status", ["in_progress", "finished", "expired", "abandoned"]);
export const attemptResultEnum = pgEnum("attempt_result", ["passed_confident", "passed", "failed"]);
/** express = short demo check for the jury (DEMO_MODE only), see TEST_CONFIG.express. */
export const attemptModeEnum = pgEnum("attempt_mode", ["full", "express"]);
export const trustLevelEnum = pgEnum("trust_level", ["high", "medium", "low"]);
export const attemptEventEnum = pgEnum("attempt_event", [
  "visibility_hidden",
  "blur",
  "copy",
  "paste",
  "fullscreen_exit",
  "fullscreen_enter",
  "bulk_insert",
  "context_menu",
  "devtools",
]);
export const verifiedStatusEnum = pgEnum("verified_status", ["unverified", "pending", "verified"]);
export const parsedByEnum = pgEnum("parsed_by", ["llm", "form", "rules"]);
export const invitationStatusEnum = pgEnum("invitation_status", [
  "sent",
  "viewed",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
]);
export const vacancyStatusEnum = pgEnum("vacancy_status", ["open", "closed"]);
export const applicationStatusEnum = pgEnum("application_status", ["sent", "viewed", "accepted", "declined"]);
export const fspStageEnum = pgEnum("fsp_stage", ["regional", "district", "final"]);
export const achievementSourceEnum = pgEnum("achievement_source", ["fsp_registry", "organizer", "repo", "self"]);
export const tokenKindEnum = pgEnum("token_kind", ["verify_email", "reset_password"]);

// ---------------------------------------------------------------- identity

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: roleEnum("role").notNull(),
  emailVerifiedAt: ts("email_verified_at"),
  /** Set on account deletion; personal data is anonymised at the same time. */
  deletedAt: ts("deleted_at"),
  createdAt: createdAt(),
});

export const emailTokens = pgTable(
  "email_tokens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: tokenKindEnum("kind").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("email_tokens_user_idx").on(t.userId)],
);

export const consents = pgTable(
  "consents",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: consentKindEnum("kind").notNull(),
    version: text("version").notNull(),
    acceptedAt: ts("accepted_at").notNull().defaultNow(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("consents_user_idx").on(t.userId, t.kind)],
);

// ---------------------------------------------------------------- candidates

export const candidateProfiles = pgTable(
  "candidate_profiles",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull().default(""),
    city: text("city"),
    about: text("about"),
    experienceYears: real("experience_years"),
    salaryExpectFrom: integer("salary_expect_from"),
    salaryExpectTo: integer("salary_expect_to"),
    /**
     * Invitation floor, ₽/month: invitations whose upper bound is below it are
     * not delivered. Shown to employers openly, so both sides save time.
     */
    inviteFloor: integer("invite_floor"),
    workFormat: workFormatEnum("work_format"),
    visibility: visibilityEnum("visibility").notNull().default("visible"),
    fspId: text("fsp_id"),
    /** Onboarding survey: preferred specialization, interests, etc. */
    survey: jsonb("survey").$type<Record<string, unknown>>(),
    onboardedAt: ts("onboarded_at"),
    lastActiveAt: ts("last_active_at").notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("candidate_profiles_visibility_idx").on(t.visibility)],
);

/**
 * Contacts are a separate entity on purpose: the employer-facing serializer
 * never joins this table unless access was granted (invitation accepted).
 */
export const candidateContacts = pgTable("candidate_contacts", {
  profileId: uuid("profile_id")
    .primaryKey()
    .references(() => candidateProfiles.id, { onDelete: "cascade" }),
  data: jsonb("data")
    .$type<{ email?: string; phone?: string; telegram?: string; links?: string[] }>()
    .notNull()
    .default({}),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const candidateSkills = pgTable(
  "candidate_skills",
  {
    id: id(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    skill: text("skill").notNull(),
    source: skillSourceEnum("source").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("candidate_skills_uniq").on(t.profileId, t.skill, t.source),
    index("candidate_skills_skill_idx").on(t.skill),
  ],
);

export const resumes = pgTable("resumes", {
  id: id(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => candidateProfiles.id, { onDelete: "cascade" }),
  fileKey: text("file_key").notNull(),
  parsedJson: jsonb("parsed_json").$type<Record<string, unknown>>(),
  parseStatus: parseStatusEnum("parse_status").notNull().default("pending"),
  parsedBy: parsedByEnum("parsed_by"),
  createdAt: createdAt(),
});

export const categories = pgTable(
  "categories",
  {
    id: id(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    specialization: specializationEnum("specialization").notNull(),
    grade: gradeEnum("grade").notNull(),
    /** Scaled score 0..30. */
    score: real("score").notNull(),
    theta: real("theta").notNull(),
    se: real("se").notNull(),
    trustLevel: trustLevelEnum("trust_level").notNull().default("high"),
    assignedAt: ts("assigned_at").notNull().defaultNow(),
    attemptId: uuid("attempt_id"),
    status: categoryStatusEnum("status").notNull().default("active"),
  },
  (t) => [
    index("categories_lookup_idx").on(t.specialization, t.grade, t.status),
    index("categories_profile_idx").on(t.profileId, t.status),
  ],
);

// ---------------------------------------------------------------- testing

export const taskTemplates = pgTable(
  "task_templates",
  {
    id: text("id").primaryKey(),
    specialization: specializationEnum("specialization").notNull(),
    kind: taskKindEnum("kind").notNull(),
    language: text("language"),
    title: text("title").notNull(),
    skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
    difficultyB: real("difficulty_b").notNull(),
    discriminationA: real("discrimination_a").notNull(),
    paramsSchema: jsonb("params_schema").$type<Record<string, unknown>>(),
    generatorRef: text("generator_ref").notNull(),
    status: templateStatusEnum("status").notNull().default("active"),
    exposureCount: integer("exposure_count").notNull().default(0),
    answeredCount: integer("answered_count").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    expectedCorrect: real("expected_correct").notNull().default(0),
    flaggedAt: ts("flagged_at"),
    flagReason: text("flag_reason"),
    calibratedAt: ts("calibrated_at"),
  },
  (t) => [index("task_templates_spec_idx").on(t.specialization, t.status)],
);

export const testAttempts = pgTable(
  "test_attempts",
  {
    id: id(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    specialization: specializationEnum("specialization").notNull(),
    targetGrade: gradeEnum("target_grade").notNull(),
    mode: attemptModeEnum("mode").notNull().default("full"),
    status: attemptStatusEnum("status").notNull().default("in_progress"),
    startedAt: ts("started_at").notNull().defaultNow(),
    deadlineAt: ts("deadline_at").notNull(),
    finishedAt: ts("finished_at"),
    theta: real("theta"),
    se: real("se"),
    score: real("score"),
    result: attemptResultEnum("result"),
    trustIndex: real("trust_index"),
    trustLevel: trustLevelEnum("trust_level"),
    trustSignals: jsonb("trust_signals").$type<Record<string, unknown>>(),
    /** Secret seed of the attempt; never sent to the client. */
    seed: text("seed").notNull(),
    /** Personal trap marker, unique per attempt. */
    marker: text("marker").notNull(),
    reviewedAt: ts("reviewed_at"),
    reviewNote: text("review_note"),
  },
  (t) => [
    index("test_attempts_profile_idx").on(t.profileId, t.specialization, t.targetGrade),
    index("test_attempts_status_idx").on(t.status, t.trustLevel),
  ],
);

export const attemptItems = pgTable(
  "attempt_items",
  {
    id: id(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => testAttempts.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    templateId: text("template_id")
      .notNull()
      .references(() => taskTemplates.id),
    seed: text("seed").notNull(),
    renderedHash: text("rendered_hash").notNull(),
    marker: text("marker").notNull(),
    /** Server-only trap data: twin values shown vs. present in DOM text. */
    traps: jsonb("traps").$type<Record<string, unknown>>(),
    servedAt: ts("served_at").notNull().defaultNow(),
    /** Nonce for hidden inputs; issued when the candidate requests final check. */
    hiddenNonce: text("hidden_nonce"),
    hiddenIssuedAt: ts("hidden_issued_at"),
    answeredAt: ts("answered_at"),
    answer: jsonb("answer").$type<unknown>(),
    code: text("code"),
    isCorrect: boolean("is_correct"),
    partialScore: real("partial_score"),
    timeMs: integer("time_ms"),
    thetaAfter: real("theta_after"),
    seAfter: real("se_after"),
    trapHits: jsonb("trap_hits").$type<string[]>(),
  },
  (t) => [
    uniqueIndex("attempt_items_pos_uniq").on(t.attemptId, t.position),
    index("attempt_items_template_idx").on(t.templateId),
  ],
);

export const attemptEvents = pgTable(
  "attempt_events",
  {
    id: id(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => testAttempts.id, { onDelete: "cascade" }),
    itemId: uuid("item_id"),
    type: attemptEventEnum("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("attempt_events_attempt_idx").on(t.attemptId)],
);

// ---------------------------------------------------------------- employers & matching

export const employers = pgTable("employers", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  inn: text("inn"),
  about: text("about"),
  site: text("site"),
  city: text("city"),
  verifiedStatus: verifiedStatusEnum("verified_status").notNull().default("unverified"),
  createdAt: createdAt(),
});

export const needs = pgTable(
  "needs",
  {
    id: id(),
    employerId: uuid("employer_id")
      .notNull()
      .references(() => employers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    rawText: text("raw_text"),
    specialization: specializationEnum("specialization").notNull(),
    grade: gradeEnum("grade").notNull(),
    stack: text("stack").array().notNull().default(sql`'{}'::text[]`),
    salaryFrom: integer("salary_from").notNull(),
    salaryTo: integer("salary_to").notNull(),
    format: workFormatEnum("format"),
    city: text("city"),
    teamAbout: text("team_about"),
    parsedBy: parsedByEnum("parsed_by").notNull().default("form"),
    createdAt: createdAt(),
  },
  (t) => [index("needs_employer_idx").on(t.employerId, t.createdAt)],
);

export type SnapshotEntry = { profileId: string; match: number; near?: boolean; unconfirmed?: boolean };

export const searches = pgTable(
  "searches",
  {
    id: id(),
    employerId: uuid("employer_id")
      .notNull()
      .references(() => employers.id, { onDelete: "cascade" }),
    needId: uuid("need_id").references(() => needs.id, { onDelete: "cascade" }),
    /** Original ranked list at search time. Filters never overwrite it. */
    baseSnapshot: jsonb("base_snapshot").$type<SnapshotEntry[]>().notNull(),
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull().default({}),
    query: jsonb("query").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("searches_employer_idx").on(t.employerId, t.createdAt)],
);

export const shortlist = pgTable(
  "shortlist",
  {
    employerId: uuid("employer_id")
      .notNull()
      .references(() => employers.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.employerId, t.profileId] })],
);

export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    employerId: uuid("employer_id")
      .notNull()
      .references(() => employers.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    needId: uuid("need_id").references(() => needs.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    salaryFrom: integer("salary_from").notNull(),
    salaryTo: integer("salary_to").notNull(),
    format: workFormatEnum("format"),
    status: invitationStatusEnum("status").notNull().default("sent"),
    declineReason: text("decline_reason"),
    createdAt: createdAt(),
    viewedAt: ts("viewed_at"),
    decidedAt: ts("decided_at"),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [
    index("invitations_employer_idx").on(t.employerId, t.createdAt),
    index("invitations_profile_idx").on(t.profileId, t.createdAt),
  ],
);

export const reportReasonEnum = pgEnum("report_reason", ["fake_vacancy", "salary_mismatch", "spam", "inappropriate", "other"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "confirmed", "dismissed"]);

/** Candidate complaints about an invitation; part of employer reputation (protection from fake vacancies). */
export const employerReports = pgTable(
  "employer_reports",
  {
    id: id(),
    employerId: uuid("employer_id")
      .notNull()
      .references(() => employers.id, { onDelete: "cascade" }),
    invitationId: uuid("invitation_id").references(() => invitations.id, { onDelete: "set null" }),
    reporterProfileId: uuid("reporter_profile_id")
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    reason: reportReasonEnum("reason").notNull(),
    note: text("note"),
    status: reportStatusEnum("status").notNull().default("open"),
    createdAt: createdAt(),
    resolvedAt: ts("resolved_at"),
    resolvedBy: uuid("resolved_by"),
    resolutionNote: text("resolution_note"),
  },
  (t) => [
    index("employer_reports_employer_idx").on(t.employerId, t.createdAt),
    uniqueIndex("employer_reports_once_idx").on(t.invitationId, t.reporterProfileId),
  ],
);

export const invitationEvents = pgTable(
  "invitation_events",
  {
    id: id(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    fromStatus: invitationStatusEnum("from_status"),
    toStatus: invitationStatusEnum("to_status").notNull(),
    actorUserId: uuid("actor_user_id"),
    note: text("note"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("invitation_events_inv_idx").on(t.invitationId)],
);

export const vacancies = pgTable(
  "vacancies",
  {
    id: id(),
    employerId: uuid("employer_id")
      .notNull()
      .references(() => employers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    specialization: specializationEnum("specialization").notNull(),
    grade: gradeEnum("grade").notNull(),
    stack: text("stack").array().notNull().default(sql`'{}'::text[]`),
    salaryFrom: integer("salary_from").notNull(),
    salaryTo: integer("salary_to").notNull(),
    format: workFormatEnum("format"),
    city: text("city"),
    status: vacancyStatusEnum("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [index("vacancies_lookup_idx").on(t.status, t.specialization, t.grade)],
);

export const applications = pgTable(
  "applications",
  {
    id: id(),
    vacancyId: uuid("vacancy_id")
      .notNull()
      .references(() => vacancies.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    coverLetter: text("cover_letter"),
    status: applicationStatusEnum("status").notNull().default("sent"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("applications_uniq").on(t.vacancyId, t.profileId)],
);

// ---------------------------------------------------------------- FSP & evidence

export const fspAchievements = pgTable(
  "fsp_achievements",
  {
    id: id(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    competition: text("competition").notNull(),
    discipline: text("discipline").notNull(),
    stage: fspStageEnum("stage").notNull(),
    year: integer("year").notNull(),
    place: integer("place"),
    rank: integer("rank"),
    sportsCategory: text("sports_category"),
    source: achievementSourceEnum("source").notNull(),
    trustLevel: trustLevelEnum("trust_level").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>(),
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("fsp_achievements_profile_idx").on(t.profileId),
    uniqueIndex("fsp_achievements_ext_uniq").on(t.profileId, t.externalId),
  ],
);

export const certificates = pgTable("certificates", {
  id: id(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => candidateProfiles.id, { onDelete: "cascade" }),
  fileKey: text("file_key").notNull(),
  title: text("title"),
  eventDate: text("event_date"),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  checks: jsonb("checks").$type<Record<string, unknown>>(),
  trustLevel: trustLevelEnum("trust_level").notNull().default("low"),
  createdAt: createdAt(),
});

export const githubLinks = pgTable("github_links", {
  profileId: uuid("profile_id")
    .primaryKey()
    .references(() => candidateProfiles.id, { onDelete: "cascade" }),
  login: text("login").notNull(),
  verifiedViaOauth: boolean("verified_via_oauth").notNull().default(false),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- infra

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorUserId: uuid("actor_user_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const llmCache = pgTable("llm_cache", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  createdAt: createdAt(),
});

export const embeddings = pgTable(
  "embeddings",
  {
    id: id(),
    ownerType: text("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    model: text("model").notNull(),
    textHash: text("text_hash").notNull(),
    vector: real("vector").array().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("embeddings_owner_uniq").on(t.ownerType, t.ownerId, t.model)],
);
