/** Seeded demo accounts (scripts/seed.ts), shown on the auth pages in DEMO_MODE. */
export const DEMO_PASSWORD = "Demo12345";

export const DEMO_ACCOUNTS = [
  { email: "candidate@demo.ru", role: "Кандидат", about: "Без категории: путь «резюме → тест → категория»" },
  { email: "strong@demo.ru", role: "Кандидат", about: "Backend · Middle: приглашения, чат, задачи от работодателей" },
  { email: "employer@demo.ru", role: "Работодатель", about: "Потребности, подборка кандидатов, приглашения, вакансии" },
  { email: "admin@demo.ru", role: "Модератор", about: "Попытки по индексу доверия, банк заданий, похожие решения" },
] as const;

export function isDemoEmail(email: string) {
  return DEMO_ACCOUNTS.some((a) => a.email === email);
}
