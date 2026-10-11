/**
 * Business constants. Everything tunable lives here so that the rules are
 * explicit and covered by tests rather than scattered across services.
 */
export const SPECIALIZATIONS = ["backend", "frontend", "data", "qa", "mobile", "devops", "analyst"] as const;
export type Specialization = (typeof SPECIALIZATIONS)[number];

/** Specializations that have a task bank and can be tested in the MVP. */
export const TESTABLE_SPECIALIZATIONS = ["backend", "frontend", "data", "qa"] as const satisfies readonly Specialization[];

export const SPECIALIZATION_TITLES: Record<Specialization, string> = {
  backend: "Backend",
  frontend: "Frontend",
  data: "Data / ML",
  qa: "QA",
  mobile: "Mobile",
  devops: "DevOps",
  analyst: "Аналитик",
};

export const GRADES = ["junior", "middle", "senior"] as const;
export type Grade = (typeof GRADES)[number];
export const GRADE_TITLES: Record<Grade, string> = { junior: "Junior", middle: "Middle", senior: "Senior" };
export const gradeIndex = (g: Grade) => GRADES.indexOf(g);

export const WORK_FORMATS = ["office", "hybrid", "remote"] as const;
export type WorkFormat = (typeof WORK_FORMATS)[number];
export const WORK_FORMAT_TITLES: Record<WorkFormat, string> = {
  office: "Офис",
  hybrid: "Гибрид",
  remote: "Удалённо",
};

export const TEST_CONFIG = {
  /** Total wall-clock limit for one attempt, enforced by the server. */
  durationMinutes: 60,
  minItems: 10,
  maxItems: 18,
  /** Stop when the standard error of theta drops below this value. */
  seStop: 0.42,
  /** Early stop when the pass/fail decision is this many SE away from the cut. */
  decisionZ: 2.0,
  quizMaxShare: 0.3,
  /** Conceptual questions are easier to leak, so they count less. */
  quizWeight: 0.6,
  /** Exposure control: next item is picked at random among top-K by information. */
  topK: 5,
  /** Starting theta per chosen grade. */
  startTheta: { junior: -0.9, middle: 0.2, senior: 1.3 } satisfies Record<Grade, number>,
  /** Cut scores on the theta scale. Passing a grade = theta >= cut. */
  cutTheta: { junior: -0.9, middle: 0.2, senior: 1.3 } satisfies Record<Grade, number>,
  /**
   * Scaled score: expected number correct on a virtual 30-item reference form
   * of the grade. Calibrated so that theta == cut gives 18/30.
   */
  scaleMax: 30,
  passScore: 18,
  /** "Confident pass": unlocks the next grade without waiting. */
  confidentScore: 25,
  /** Cooldown before retrying the same specialization + grade. */
  retrySameGradeDays: 14,
  /** After the first finished attempt the candidate may climb grades freely for this long. */
  calibrationDays: 7,
  /** Afterwards, a test above the active category opens this long after it was assigned. */
  gradeChangeCooldownDays: 90,
  /**
   * Express check for the jury (Q&A: "a 3-5 minute express test is fine, but
   * they must be able to take the test themselves"). Available only with
   * DEMO_MODE: short questions without code, the same CAT and scoring, the
   * category is marked "express"; it does not touch calibration counters or
   * the leak detector and does not count towards retake cooldowns.
   */
  express: { minItems: 6, maxItems: 6, durationMinutes: 15, kinds: ["quiz", "calc"] as const },
  /** Seconds allowed for in-browser execution of hidden tests. */
  hiddenRunTimeoutMs: 8000,
  /** Window between issuing hidden inputs and receiving outputs. */
  hiddenWindowSeconds: 120,
} as const;

/** Regular employer challenges between full tests. */
export const CHALLENGE_CONFIG = {
  /** A new challenge is offered at most once per this many days. */
  periodDays: 14,
  /** A graded result counts as a fresh signal for this long. */
  signalDays: 90,
  /** Score (0..3) from which the result is shown to employers as a plus. */
  goodScore: 2,
} as const;

export const INVITATION_CONFIG = {
  perEmployerPerDay: 30,
  expiresAfterDays: 14,
} as const;

/** Weights of the matching score components; sum is normalised to 100. */
export const MATCH_WEIGHTS = {
  test: 0.4,
  stack: 0.22,
  fsp: 0.14,
  salary: 0.1,
  formatCity: 0.07,
  freshness: 0.07,
} as const;

export const FSP_CONFIG = {
  topN: 5,
  tailWeight: 0.5,
  /** Weight of a confirmed achievement by trust source. */
  trustWeight: { fsp_registry: 1, organizer: 0.8, repo: 0.6, self: 0.2 },
  stageWeight: { regional: 0.6, district: 0.8, final: 1 },
  /** Half-life of achievement relevance, years. */
  halfLifeYears: 3,
} as const;

export const CONSENT_VERSIONS = {
  pd_processing: "2026-10-01",
  privacy_policy: "2026-10-01",
  marketing: "2026-10-01",
} as const;

export const SALARY_LIMITS = { min: 1, max: 10_000_000 } as const;
