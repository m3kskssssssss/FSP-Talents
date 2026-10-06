/** Generates docs/libraries.md: every direct dependency with the installed version and license. */
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
const PURPOSE: Record<string, string> = {
  next: "Фреймворк: UI (App Router) и API (route handlers)",
  react: "UI", "react-dom": "UI",
  "next-auth": "Аутентификация (Auth.js v5): пароль, роли, Keycloak OIDC",
  "drizzle-orm": "ORM для PostgreSQL", "drizzle-kit": "Миграции схемы", postgres: "Драйвер PostgreSQL",
  zod: "Валидация входных данных", "@asteasolutions/zod-to-openapi": "OpenAPI 3.1 из Zod-схем",
  "@node-rs/argon2": "Хеширование паролей (argon2id)", openai: "Клиент RouterAI (OpenAI-совместимый API)",
  seedrandom: "Детерминированный RNG генераторов заданий", "sql.js": "SQLite/WASM: эталон SQL-заданий на сервере и песочница в браузере",
  codemirror: "Редактор кода в тесте", "@codemirror/lang-python": "Подсветка Python", "@codemirror/lang-javascript": "Подсветка JS", "@codemirror/lang-sql": "Подсветка SQL",
  "@codemirror/state": "CodeMirror", "@codemirror/view": "CodeMirror", "@codemirror/commands": "CodeMirror", "@codemirror/language": "CodeMirror", "@lezer/highlight": "CodeMirror (подсветка синтаксиса)",
  unpdf: "Извлечение текста из PDF-резюме", "@react-pdf/renderer": "Генерация PDF-резюме",
  "pdf-lib": "Метаданные и структура PDF-сертификатов", exifr: "EXIF изображений сертификатов",
  nodemailer: "Почта через SMTP (Mailpit локально)", resend: "Почта на Vercel", "@vercel/blob": "Хранилище файлов на Vercel",
  "@upstash/ratelimit": "Rate limit (если задан Upstash)", "@upstash/redis": "Rate limit (если задан Upstash)",
  vitest: "Юнит- и интеграционные тесты", "@playwright/test": "Сквозные тесты", tailwindcss: "Стили", "@tailwindcss/postcss": "Стили",
  typescript: "Язык", eslint: "Линтер", prettier: "Форматирование", tsx: "Запуск TS-скриптов (seed, validate)",
};
const row = (name: string, kind: string) => {
  let version = "?", license = "?";
  try {
    const p = JSON.parse(readFileSync(`node_modules/${name}/package.json`, "utf8")) as { version: string; license?: string };
    version = p.version;
    license = p.license ?? "?";
  } catch {
    /* not installed */
  }
  return `| \`${name}\` | ${version} | ${license} | ${kind} | ${PURPOSE[name] ?? ""} |`;
};
const lines = [
  "# Библиотеки и версии",
  "",
  "Сгенерировано скриптом `npm run docs:libs` из `package.json` и установленных пакетов.",
  "",
  "| Пакет | Версия | Лицензия | Тип | Назначение |",
  "|---|---|---|---|---|",
  ...Object.keys(pkg.dependencies).sort().map((n) => row(n, "runtime")),
  ...Object.keys(pkg.devDependencies).sort().map((n) => row(n, "dev")),
  "",
  "Загружаются в браузере с CDN jsDelivr: Pyodide 314.0.7 (Python в Web Worker), sql.js 1.14.2 (SQLite/WASM), swagger-ui-dist 5 (страница /api/docs).",
  "",
  "Шрифты: Golos Text и JetBrains Mono (SIL OFL 1.1; файлы лицензий — `server/pdf/fonts/`).",
  "",
];
writeFileSync("docs/libraries.md", lines.join("\n"));
console.log("docs/libraries.md written");
