import { z } from "zod";
import { GRADES, SPECIALIZATIONS, WORK_FORMATS, type Grade, type Specialization, type WorkFormat } from "../config";
import { structured } from "../llm";
import { redactPersonalData } from "../llm/redact";
import { extractSkills, normalizeSkill } from "./skills";

export interface NeedDraft {
  title: string;
  specialization: Specialization | null;
  grade: Grade | null;
  stack: string[];
  salaryFrom: number | null;
  salaryTo: number | null;
  format: WorkFormat | null;
  city: string | null;
  teamAbout: string | null;
}

export const KNOWN_CITIES = [
  "Москва", "Санкт-Петербург", "Новосибирск", "Екатеринбург", "Казань", "Нижний Новгород", "Челябинск", "Самара",
  "Омск", "Ростов-на-Дону", "Уфа", "Красноярск", "Воронеж", "Пермь", "Волгоград", "Краснодар", "Томск", "Иннополис",
  "Тюмень", "Владивосток", "Калининград", "Ярославль", "Сочи", "Иркутск",
];

const SPEC_WORDS: Record<Specialization, RegExp[]> = {
  backend: [/бэкенд|бекенд|backend|back-end|серверн/i, /\bapi\b|django|fastapi|spring|nestjs|golang|микросервис/i],
  frontend: [/фронтенд|frontend|front-end|верстальщик|вёрстк|верстк/i, /react|vue|angular|next\.js|typescript/i],
  data: [/data scien|\bml\b|машинн\w* обучен|аналитик данных|data analyst|data engineer|дата-|датасаентист|нейросет/i, /pandas|pytorch|sklearn|spark|airflow|clickhouse/i],
  qa: [/тестировщик|\bqa\b|автотест|тестирован|quality assurance|sdet/i, /selenium|playwright|cypress|pytest|postman|тест-кейс/i],
  mobile: [/мобильн|\bios\b|android|flutter|react native/i, /swift|kotlin/i],
  devops: [/devops|\bsre\b|инфраструктур|платформенн/i, /kubernetes|k8s|terraform|ansible|ci\/cd/i],
  analyst: [/системн\w* аналитик|бизнес-аналитик|system analyst|business analyst/i, /bpmn|uml|требовани/i],
};

function detectSpec(text: string): Specialization | null {
  let best: Specialization | null = null;
  let bestScore = 0;
  for (const s of SPECIALIZATIONS) {
    const [strong, weak] = SPEC_WORDS[s];
    const score = (strong!.test(text) ? 3 : 0) + (weak!.test(text) ? 1 : 0);
    if (score > bestScore) [best, bestScore] = [s, score];
  }
  return best;
}

function detectGrade(text: string): Grade | null {
  if (/\b(senior|сеньор|синьор|ведущ\w*|lead|лид|тимлид|старш\w*)\b/i.test(text)) return "senior";
  if (/\b(middle|мидл|миддл)\b/i.test(text)) return "middle";
  if (/\b(junior|джун\w*|джуниор|младш\w*|стажёр|стажер|intern)\b/i.test(text)) return "junior";
  const years = /опыт\w*[^.\n]{0,25}?(?:от|не менее|более)\s*(\d+)/i.exec(text);
  if (years) {
    const y = Number(years[1]);
    return y >= 5 ? "senior" : y >= 2 ? "middle" : "junior";
  }
  return null;
}

/** Parses "от 150 000 до 250 000 ₽", "150–250 тыс.", "200k-300k", "до 180 000". */
export function parseSalary(text: string): { from: number | null; to: number | null } {
  const norm = text.replace(/ /g, " ");
  const num = String.raw`(\d{1,3}(?:[  ]?\d{3})+|\d+(?:[.,]\d+)?)\s*(тыс\.?|т\.р\.?|k|к|000)?`;
  const unit = (v: string, u?: string) => {
    let n = Number(v.replace(/[  ]/g, "").replace(",", "."));
    if (u && /тыс|т\.р|k|к/i.test(u)) n *= 1000;
    if (n < 1000) n *= 1000; // "150-250" in a salary context means thousands
    return Math.round(n);
  };
  const range = new RegExp(String.raw`(?:от\s*)?${num}\s*(?:-|–|—|до)\s*${num}\s*(?:₽|руб|р\.|rub|тыс|k|к|$)?`, "i");
  const ctx = /(зарплат|оклад|доход|вилк|₽|руб|net|gross|на руки|з\/п|зп)/i;
  for (const line of norm.split(/\n|\. /)) {
    if (!ctx.test(line)) continue;
    const m = range.exec(line);
    if (m) {
      const from = unit(m[1]!, m[2] ?? m[4]);
      const to = unit(m[3]!, m[4] ?? m[2]);
      if (from > 0 && to >= from) return { from, to };
    }
    const fromOnly = new RegExp(String.raw`от\s*${num}`, "i").exec(line);
    const toOnly = new RegExp(String.raw`до\s*${num}`, "i").exec(line);
    if (fromOnly || toOnly) {
      return {
        from: fromOnly ? unit(fromOnly[1]!, fromOnly[2]) : null,
        to: toOnly ? unit(toOnly[1]!, toOnly[2]) : null,
      };
    }
  }
  return { from: null, to: null };
}

function detectFormat(text: string): WorkFormat | null {
  if (/гибрид|hybrid/i.test(text)) return "hybrid";
  if (/удал[её]н|remote|из дома|дистанционн/i.test(text)) return "remote";
  if (/офис|on-?site/i.test(text)) return "office";
  return null;
}

function detectCity(text: string) {
  return KNOWN_CITIES.find((c) => new RegExp(`(^|[^а-яё])${c.slice(0, -1)}`, "i").test(text)) ?? null;
}

/** Deterministic fallback: dictionaries + regular expressions. */
export function parseNeedRules(text: string): NeedDraft {
  const firstLine = text.split("\n").map((s) => s.trim()).find(Boolean) ?? "Вакансия";
  const sal = parseSalary(text);
  return {
    title: firstLine.slice(0, 120),
    specialization: detectSpec(text),
    grade: detectGrade(text),
    stack: extractSkills(text),
    salaryFrom: sal.from,
    salaryTo: sal.to,
    format: detectFormat(text),
    city: detectCity(text),
    teamAbout: null,
  };
}

const llmNeedSchema = z.object({
  title: z.string().describe("Короткое название позиции"),
  specialization: z.enum(SPECIALIZATIONS).nullable(),
  grade: z.enum(GRADES).nullable(),
  stack: z.array(z.string()).describe("Технологии, только явно упомянутые"),
  salaryFrom: z.number().int().nullable().describe("Нижняя граница в рублях в месяц"),
  salaryTo: z.number().int().nullable().describe("Верхняя граница в рублях в месяц"),
  format: z.enum(WORK_FORMATS).nullable(),
  city: z.string().nullable(),
  teamAbout: z.string().nullable().describe("1-2 предложения о команде и задачах"),
});

/** LLM parse with the rule-based result as a fallback and as a safety net for missing fields. */
export async function parseNeedText(text: string): Promise<{ draft: NeedDraft; parsedBy: "llm" | "rules" }> {
  const rules = parseNeedRules(text);
  const llm = await structured(
    "vacancy",
    llmNeedSchema,
    [
      {
        role: "system",
        content:
          "Ты извлекаешь структуру из текста вакансии ИТ-специалиста. Используй только факты из текста, ничего не придумывай; если поля нет — null. " +
          "Специализации: backend, frontend, data (Data/ML/аналитика данных), qa, mobile, devops, analyst (системный/бизнес-аналитик). Зарплата — рубли в месяц, целые числа.",
      },
      // Recruiter contacts are not needed to parse a vacancy and are not sent.
      { role: "user", content: redactPersonalData(text).slice(0, 8000) },
    ],
    { maxTokens: 700, budgetMs: 20000 },
  );
  if (!llm) return { draft: rules, parsedBy: "rules" };
  const stack = [...new Set([...llm.stack.map(normalizeSkill).filter((s): s is string => Boolean(s)), ...rules.stack])].sort();
  return {
    draft: {
      title: llm.title || rules.title,
      specialization: llm.specialization ?? rules.specialization,
      grade: llm.grade ?? rules.grade,
      stack,
      salaryFrom: llm.salaryFrom ?? rules.salaryFrom,
      salaryTo: llm.salaryTo ?? rules.salaryTo,
      format: llm.format ?? rules.format,
      city: llm.city ?? rules.city,
      teamAbout: llm.teamAbout,
    },
    parsedBy: "llm",
  };
}
