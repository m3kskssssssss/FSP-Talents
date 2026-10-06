/**
 * Personal-data minimisation before any text leaves for an external LLM
 * (152-FZ; on the Q&A the organisers asked to avoid cross-border transfer of
 * personal data). Contacts and the name are extracted locally by rules and
 * never sent; the model only sees the professional part of the text.
 *
 * This is minimisation, not a guarantee: free text can still contain
 * indirectly identifying details (employers, dates), which is why the
 * documentation says "minimised", not "anonymised".
 */

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// +7 / 8 Russian numbers and generic international ones (at least 10 digits with separators).
const PHONE = /(?:\+7|\b8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b|\+\d{1,3}(?:[\s().-]*\d){9,12}/g;
const TELEGRAM = /(?:https?:\/\/)?t\.me\/[\w]+|(?:telegram|tg|телеграм)[:\s]+@?[A-Za-z][\w]{4,31}|(?<![\w.@])@[A-Za-z][\w]{4,31}/gi;
// Profile links identify a person by their username; plain project links are kept.
const PROFILE_LINK = /(?:https?:\/\/)?(?:www\.)?(?:github\.com|gitlab\.com|linkedin\.com|habr\.com|career\.habr\.com|hh\.ru|vk\.com|leetcode\.com|codeforces\.com)\/[^\s,)]+/gi;
const BIRTH = /(?:дата рождения|д\.\s?р\.|родил(?:ся|ась)|date of birth|born)[:\s]*[^\n]{0,30}/gi;
const LABELLED_NAME = /^(\s*(?:фио|имя|фамилия|name|full name)\s*[:—-]\s*).+$/gim;
// Two or three capitalised words alone on a line: "Иван Петров", "ПЕТРОВ Иван", "Ivan Petrov".
const NAME_LINE = /^\s*(?:[A-ZА-ЯЁ][a-zа-яё]+|[A-ZА-ЯЁ]{2,})(?:\s+(?:[A-ZА-ЯЁ][a-zа-яё]+|[A-ZА-ЯЁ]{2,}|[A-ZА-ЯЁ]\.)){1,2}\s*$/;

// A heading such as "Backend Developer" or "Резюме Разработчика" is not a name.
const NOT_A_NAME = /developer|engineer|analyst|tester|designer|manager|lead|senior|middle|junior|intern|backend|frontend|fullstack|devops|data|python|java|резюме|разработчик|инженер|аналитик|тестировщик|программист|специалист|руководитель|стажёр|стажер|контакты|опыт|навыки|образование|о себе|summary|experience|skills|education|contacts/i;

const escape =(s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface RedactOptions {
  /** Names already found locally (e.g. by the resume rules): every part is masked everywhere. */
  names?: (string | null | undefined)[];
  /** Also mask name-like lines among the first lines (resumes usually start with the name). */
  headLines?: number;
}

export function redactPersonalData(text: string, opts: RedactOptions = {}): string {
  let out = text
    .replace(EMAIL, "[EMAIL]")
    .replace(PROFILE_LINK, "[LINK]")
    .replace(TELEGRAM, "[TELEGRAM]")
    .replace(PHONE, "[PHONE]")
    .replace(BIRTH, "[ДАТА РОЖДЕНИЯ]")
    .replace(LABELLED_NAME, "$1[ИМЯ]");

  if (opts.headLines) {
    const lines = out.split("\n");
    let seen = 0;
    for (let i = 0; i < lines.length && seen < opts.headLines; i++) {
      if (!lines[i]!.trim()) continue;
      seen++;
      if (NAME_LINE.test(lines[i]!) && !NOT_A_NAME.test(lines[i]!)) lines[i] = "[ИМЯ]";
    }
    out = lines.join("\n");
  }

  const parts = new Set(
    (opts.names ?? [])
      .filter((n): n is string => Boolean(n))
      .flatMap((n) => n.split(/\s+/))
      .map((p) => p.replace(/[^\p{L}-]/gu, ""))
      .filter((p) => p.length >= 2),
  );
  for (const p of parts) {
    // \b does not work for Cyrillic, so use explicit letter look-arounds.
    out = out.replace(new RegExp(`(?<![\\p{L}])${escape(p)}(?![\\p{L}])`, "giu"), "[ИМЯ]");
  }
  return out;
}
