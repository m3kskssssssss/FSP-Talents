import { z } from "zod";
import { structured } from "../llm";
import { redactPersonalData } from "../llm/redact";
import { KNOWN_CITIES } from "../matching/need-parser";
import { extractSkills, normalizeSkill } from "../matching/skills";

export interface ResumeDraft {
  fullName: string | null;
  city: string | null;
  experienceYears: number | null;
  about: string | null;
  skills: string[];
  education: string[];
  contacts: { email?: string; phone?: string; telegram?: string; links?: string[] };
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE = /(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/;
const TG = /(?:t\.me\/|telegram[:\s]+@?|(?<![\w.])@)([A-Za-z][\w]{4,31})/i;
const LINK = /https?:\/\/(?:www\.)?(?:github\.com|gitlab\.com|linkedin\.com|habr\.com|career\.habr\.com|hh\.ru)\/[^\s,)]+/gi;

/** Deterministic fallback: regexes + dictionaries. */
export function parseResumeRules(text: string): ResumeDraft {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const nameLine = lines.slice(0, 5).find((l) => /^[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2}$/.test(l));
  // PDF text extraction often glues neighbouring lines ("СмирноваКазань"), so match the
  // capitalised stem without a word boundary (case-sensitive to avoid false hits).
  const city = KNOWN_CITIES.find((c) => text.includes(c.slice(0, -1))) ?? null;
  let years: number | null = null;
  const exp = /опыт[^.\n\d]{0,30}(\d{1,2})(?:[.,]\d)?\s*(?:год|лет|года)/i.exec(text);
  if (exp) years = Number(exp[1]);
  else {
    const ranges = [...text.matchAll(/(20\d{2}|19\d{2})\s*[–—-]\s*(20\d{2}|н\.?\s?в\.?|настоящее время|по настоящее время|сейчас)/gi)];
    if (ranges.length) {
      const now = new Date().getFullYear();
      years = Math.min(40, ranges.reduce((s, m) => s + Math.max(0, (/^\d/.test(m[2]!) ? Number(m[2]) : now) - Number(m[1])), 0));
    }
  }
  const tg = TG.exec(text.replace(EMAIL, " "));
  return {
    fullName: nameLine ?? null,
    city,
    experienceYears: years,
    about: null,
    skills: extractSkills(text),
    education: lines.filter((l) => /университет|институт|академи|колледж|МГУ|МФТИ|ВШЭ|ИТМО|бакалавр|магистр/i.test(l)).slice(0, 3),
    contacts: {
      email: EMAIL.exec(text)?.[0],
      phone: PHONE.exec(text)?.[0],
      telegram: tg ? `@${tg[1]}` : undefined,
      links: [...new Set(text.match(LINK) ?? [])].slice(0, 5),
    },
  };
}

// No name or contacts: the model never sees them (they are masked) and never returns them.
const llmSchema = z.object({
  city: z.string().nullable(),
  experienceYears: z.number().nullable().describe("Суммарный коммерческий опыт в годах"),
  about: z.string().nullable().describe("1-2 предложения о кандидате по тексту резюме, без имени"),
  skills: z.array(z.string()),
  education: z.array(z.string()),
});

/**
 * LLM extraction with the rules as fallback and safety net. The name and
 * contacts are extracted locally by rules and go straight to the protected
 * table; the text sent to the model is masked (`redactPersonalData`).
 */
export async function parseResumeText(text: string): Promise<{ draft: ResumeDraft; parsedBy: "llm" | "rules" }> {
  const rules = parseResumeRules(text);
  const masked = redactPersonalData(text, { names: [rules.fullName], headLines: 3 });
  const llm = await structured(
    "resume",
    llmSchema,
    [
      {
        role: "system",
        content:
          "Извлеки из текста резюме ИТ-специалиста структуру. Только факты из текста; чего нет — null или пустой список. Персональные данные в тексте заменены метками вида [ИМЯ], [EMAIL] — не пытайся их восстановить.",
      },
      { role: "user", content: masked.slice(0, 12000) },
    ],
    { maxTokens: 900, budgetMs: 20000 },
  );
  if (!llm) return { draft: rules, parsedBy: "rules" };
  const skills = [...new Set([...llm.skills.map(normalizeSkill).filter((s): s is string => Boolean(s)), ...rules.skills])].sort();
  return {
    draft: {
      fullName: rules.fullName,
      city: llm.city ?? rules.city,
      experienceYears: llm.experienceYears ?? rules.experienceYears,
      about: llm.about?.includes("[") ? null : llm.about,
      skills,
      education: llm.education.length ? llm.education : rules.education,
      contacts: rules.contacts,
    },
    parsedBy: "llm",
  };
}
