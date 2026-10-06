/**
 * Canonical skill dictionary with aliases (RU/EN). Used by the resume and
 * vacancy parsers (rule-based fallback) and by stack matching.
 */
export const SKILLS: Record<string, { title: string; aliases: string[] }> = {
  python: { title: "Python", aliases: ["python", "питон", "python3"] },
  javascript: { title: "JavaScript", aliases: ["javascript", "js", "ecmascript", "es6"] },
  typescript: { title: "TypeScript", aliases: ["typescript", "ts"] },
  java: { title: "Java", aliases: ["java"] },
  kotlin: { title: "Kotlin", aliases: ["kotlin"] },
  go: { title: "Go", aliases: ["go", "golang"] },
  csharp: { title: "C#", aliases: ["c#", ".net", "dotnet", "asp.net"] },
  cpp: { title: "C++", aliases: ["c++", "cpp"] },
  php: { title: "PHP", aliases: ["php", "laravel", "symfony"] },
  rust: { title: "Rust", aliases: ["rust"] },
  sql: { title: "SQL", aliases: ["sql"] },
  postgresql: { title: "PostgreSQL", aliases: ["postgresql", "postgres", "постгрес", "psql"] },
  mysql: { title: "MySQL", aliases: ["mysql", "mariadb"] },
  clickhouse: { title: "ClickHouse", aliases: ["clickhouse"] },
  mongodb: { title: "MongoDB", aliases: ["mongodb", "mongo"] },
  redis: { title: "Redis", aliases: ["redis"] },
  kafka: { title: "Kafka", aliases: ["kafka"] },
  rabbitmq: { title: "RabbitMQ", aliases: ["rabbitmq", "rabbit"] },
  docker: { title: "Docker", aliases: ["docker", "докер"] },
  kubernetes: { title: "Kubernetes", aliases: ["kubernetes", "k8s"] },
  linux: { title: "Linux", aliases: ["linux", "линукс", "bash"] },
  git: { title: "Git", aliases: ["git", "gitlab", "github"] },
  cicd: { title: "CI/CD", aliases: ["ci/cd", "cicd", "jenkins", "github actions", "gitlab ci"] },
  rest: { title: "REST API", aliases: ["rest", "rest api", "restful"] },
  graphql: { title: "GraphQL", aliases: ["graphql"] },
  grpc: { title: "gRPC", aliases: ["grpc"] },
  microservices: { title: "Микросервисы", aliases: ["микросервисы", "микросервисная", "microservices"] },
  django: { title: "Django", aliases: ["django"] },
  fastapi: { title: "FastAPI", aliases: ["fastapi"] },
  flask: { title: "Flask", aliases: ["flask"] },
  spring: { title: "Spring", aliases: ["spring", "spring boot"] },
  nodejs: { title: "Node.js", aliases: ["node.js", "nodejs", "node"] },
  nestjs: { title: "NestJS", aliases: ["nestjs", "nest.js"] },
  react: { title: "React", aliases: ["react", "react.js", "reactjs"] },
  vue: { title: "Vue", aliases: ["vue", "vue.js", "vuejs", "nuxt"] },
  angular: { title: "Angular", aliases: ["angular"] },
  nextjs: { title: "Next.js", aliases: ["next.js", "nextjs"] },
  html: { title: "HTML", aliases: ["html", "html5"] },
  css: { title: "CSS", aliases: ["css", "css3", "scss", "sass", "вёрстка", "верстка"] },
  redux: { title: "Redux", aliases: ["redux", "mobx", "zustand"] },
  webpack: { title: "Webpack / Vite", aliases: ["webpack", "vite"] },
  pandas: { title: "pandas", aliases: ["pandas"] },
  numpy: { title: "NumPy", aliases: ["numpy"] },
  sklearn: { title: "scikit-learn", aliases: ["scikit-learn", "sklearn"] },
  pytorch: { title: "PyTorch", aliases: ["pytorch", "torch"] },
  tensorflow: { title: "TensorFlow", aliases: ["tensorflow", "keras"] },
  spark: { title: "Spark", aliases: ["spark", "pyspark"] },
  airflow: { title: "Airflow", aliases: ["airflow"] },
  ml: { title: "Машинное обучение", aliases: ["machine learning", "машинное обучение", "ml"] },
  statistics: { title: "Статистика", aliases: ["статистика", "statistics", "a/b", "ab-тест", "a/b-тесты"] },
  bi: { title: "BI", aliases: ["tableau", "power bi", "superset", "datalens"] },
  selenium: { title: "Selenium", aliases: ["selenium"] },
  playwright: { title: "Playwright", aliases: ["playwright"] },
  cypress: { title: "Cypress", aliases: ["cypress"] },
  pytest: { title: "pytest", aliases: ["pytest"] },
  jest: { title: "Jest", aliases: ["jest", "vitest"] },
  postman: { title: "Postman", aliases: ["postman", "insomnia"] },
  jmeter: { title: "JMeter", aliases: ["jmeter", "k6", "нагрузочное"] },
  testdesign: { title: "Тест-дизайн", aliases: ["тест-дизайн", "тест дизайн", "test design", "тест-кейсы", "тест кейсы"] },
  swift: { title: "Swift", aliases: ["swift", "swiftui"] },
  android: { title: "Android", aliases: ["android"] },
  flutter: { title: "Flutter", aliases: ["flutter", "dart"] },
  terraform: { title: "Terraform", aliases: ["terraform", "ansible"] },
  cloud: { title: "Облака", aliases: ["aws", "yandex cloud", "яндекс облако", "gcp", "azure"] },
};

const aliasIndex = new Map<string, string>();
for (const [key, s] of Object.entries(SKILLS)) for (const a of s.aliases) aliasIndex.set(a, key);

/** Skills implied by a confirmed one (e.g. a passed SQL task partially confirms PostgreSQL). */
export const IMPLIES: Record<string, string[]> = {
  sql: ["postgresql", "mysql", "clickhouse"],
  javascript: ["typescript", "nodejs"],
  python: ["pandas", "pytest"],
};

/** Test templates tag skills in Russian topics; map them to canonical keys where possible. */
const TOPIC_TO_SKILL: Record<string, string> = {
  "http": "rest",
  "api": "rest",
  "микросервисы": "microservices",
  "postgresql": "postgresql",
  "тест-дизайн": "testdesign",
};

export function normalizeSkill(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (SKILLS[s]) return s;
  return aliasIndex.get(s) ?? TOPIC_TO_SKILL[s] ?? null;
}

export const skillTitle = (key: string) => SKILLS[key]?.title ?? key.charAt(0).toUpperCase() + key.slice(1);

/** Finds known skills in free text (word-boundary aware for short aliases). */
export function extractSkills(text: string): string[] {
  const lower = ` ${text.toLowerCase().replace(/[(),;:/|•·\n\t]+/g, " ")} `;
  const found = new Set<string>();
  for (const [alias, key] of aliasIndex) {
    const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[\\s,])${esc}(?=$|[\\s,.!?])`, "i");
    if (re.test(lower)) found.add(key);
  }
  // "go" is too ambiguous in Russian/English prose unless written as golang.
  if (found.has("go") && !/\bgolang\b|\bgo\s*(разработчик|developer|1\.\d)/i.test(text)) found.delete("go");
  if (found.has("ml") && !/machine learning|машинн|\bml\b/i.test(text)) found.delete("ml");
  return [...found].sort();
}
