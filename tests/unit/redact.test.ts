import { describe, expect, it } from "vitest";
import { redactPersonalData } from "@/server/llm/redact";

const resume = `Анна Смирнова
Backend Developer
Москва · anna.smirnova@mail.ru · +7 (912) 345-67-89 · @anna_dev
github.com/annasmirnova · t.me/anna_dev_tg
Дата рождения: 12.03.1999

Опыт 4 года: Python, FastAPI, PostgreSQL. В «Кванта Софт» Смирнова отвечала за API.`;

describe("personal data redaction before LLM (152-FZ)", () => {
  const out = redactPersonalData(resume, { names: ["Анна Смирнова"], headLines: 3 });

  it("masks contacts, profile links, birth date and every part of the name", () => {
    for (const secret of ["anna.smirnova@mail.ru", "345-67-89", "@anna_dev", "annasmirnova", "anna_dev_tg", "12.03.1999", "Смирнова", "Анна"]) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain("[EMAIL]");
    expect(out).toContain("[PHONE]");
  });

  it("keeps the professional part", () => {
    for (const keep of ["Backend Developer", "Москва", "Python, FastAPI, PostgreSQL", "Опыт 4 года", "Кванта Софт"]) expect(out).toContain(keep);
  });

  it("masks a name line even when the rules did not find the name", () => {
    expect(redactPersonalData("Ivan Petrov\nPython developer", { headLines: 3 })).toBe("[ИМЯ]\nPython developer");
    expect(redactPersonalData("ФИО: Петров Иван Сергеевич\nJava")).toBe("ФИО: [ИМЯ]\nJava");
  });

  it("does not touch vacancy text without personal data", () => {
    const v = "Ищем Middle Python-разработчика, 200 000 – 300 000 ₽, удалённо. Стек: Django, Redis.";
    expect(redactPersonalData(v)).toBe(v);
  });
});
