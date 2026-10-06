import { describe, expect, it } from "vitest";
import { parseNeedRules, parseSalary } from "@/server/matching/need-parser";

describe("vacancy parser (rule-based fallback)", () => {
  it("parses salary formats", () => {
    expect(parseSalary("Зарплата: от 150 000 до 250 000 ₽")).toEqual({ from: 150000, to: 250000 });
    expect(parseSalary("Вилка 180–260 тыс. на руки")).toEqual({ from: 180000, to: 260000 });
    expect(parseSalary("ЗП 200k-300k gross")).toEqual({ from: 200000, to: 300000 });
    expect(parseSalary("Оклад до 120 000 руб.")).toEqual({ from: null, to: 120000 });
    expect(parseSalary("Команда из 5 человек, 2 офиса")).toEqual({ from: null, to: null });
  });

  it("extracts a structured need", () => {
    const d = parseNeedRules(`Middle Python-разработчик (backend)
Мы — финтех-команда в Казани. Гибридный формат.
Стек: Python, FastAPI, PostgreSQL, Redis, Docker.
Зарплата от 220 000 до 300 000 ₽.`);
    expect(d).toMatchObject({
      title: "Middle Python-разработчик (backend)",
      specialization: "backend",
      grade: "middle",
      salaryFrom: 220000,
      salaryTo: 300000,
      format: "hybrid",
      city: "Казань",
    });
    expect(d.stack).toEqual(expect.arrayContaining(["python", "fastapi", "postgresql", "redis", "docker"]));
  });

  it("detects QA and grade by experience", () => {
    const d = parseNeedRules("Ищем инженера по автотестированию. Опыт от 3 лет, Playwright, pytest. Удалённо.");
    expect(d.specialization).toBe("qa");
    expect(d.grade).toBe("middle");
    expect(d.format).toBe("remote");
  });
});
