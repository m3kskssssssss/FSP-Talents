import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArticleCard } from "@/components/blog/article-card";
import { CandidateTeaser, LockIcon } from "@/components/landing/candidate-teaser";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { Logo } from "@/components/ui/logo";
import { Pattern } from "@/components/ui/pattern";
import { articles } from "@/lib/blog";
import { categoryTitle, formatTitle, salaryRange } from "@/lib/format";
import { landingData, type LandingData } from "@/server/services/landing";

export const dynamic = "force-dynamic";

const candidateSteps = [
  ["01", "Профиль", "Заполните профиль или загрузите PDF-резюме — мы разберём его автоматически."],
  [
    "02",
    "Грейд и тест",
    "Выберите грейд и пройдите адаптивный тест: задания подстраиваются под вас, вариант уникален.",
  ],
  [
    "03",
    "Категория",
    "Получите категорию «специализация · грейд». Только после этого вас увидят работодатели.",
  ],
  [
    "04",
    "Приглашения",
    "Работодатели сами пишут вам с вилкой зарплаты. Контакты открываются, только если вы согласитесь.",
  ],
];
const employerSteps = [
  [
    "01",
    "Потребность",
    "Заполните форму или вставьте текст вакансии — система разберёт его в структуру.",
  ],
  [
    "02",
    "Подборка",
    "Кандидаты из нужной категории, ранжированные по результату теста, стеку и достижениям ФСП, с доводами «за» и «против».",
  ],
  ["03", "Уточнение", "Фильтры поверх подборки — исходный список не теряется."],
  [
    "04",
    "Приглашение",
    "Пригласите конкретного человека с вилкой. Приняв, он откроет вам контакты.",
  ],
];
const ticker = [
  "Python",
  "Go",
  "Java",
  "TypeScript",
  "React",
  "SQL",
  "PostgreSQL",
  "Kafka",
  "Docker",
  "Kubernetes",
  "Kotlin",
  "Swift",
  "C++",
  "ML",
  "Алгоритмы",
  "QA-автоматизация",
  "Linux",
  "Rust",
];

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

async function loadLanding(): Promise<LandingData | null> {
  try {
    return await landingData();
  } catch {
    // The landing page must stay up even if the database is not reachable.
    return null;
  }
}

export default async function Home() {
  const data = await loadLanding();
  return (
    <div className="flex flex-col gap-16 sm:gap-24">
      <Hero />

      {data && (
        <section aria-label="Платформа в цифрах" className="-mt-6 sm:-mt-12">
          <ul className="border-accent/45 bg-surface grid grid-cols-2 overflow-hidden rounded-[var(--radius-blank)] border lg:grid-cols-4">
            {[
              [data.stats.candidates, "кандидатов с категорией"],
              [data.stats.vacancies, "открытых вакансий"],
              [data.stats.employers, "проверенных компаний"],
              [data.stats.templates, "шаблонов заданий в банке"],
            ].map(([n, label], i) => (
              <li
                key={label}
                className="rise border-accent/15 flex flex-col gap-1 p-5 max-lg:odd:border-r sm:p-7 lg:not-last:border-r max-lg:[&:nth-child(-n+2)]:border-b"
                style={delay(300 + i * 90)}
              >
                <CountUp value={n as number} className="h-display font-mono text-3xl sm:text-4xl" />
                <span className="text-muted text-sm">{label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Как это работает" className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        {[
          { id: "how-cand", title: "Кандидату", steps: candidateSteps },
          { id: "how-emp", title: "Работодателю", steps: employerSteps },
        ].map((col) => (
          <div key={col.id} className="reveal">
            <h2 id={col.id} className="h-display mb-8 text-2xl sm:text-3xl">
              {col.title}
            </h2>
            {/* The brand "track": one thin line through the steps, a dot at each stop. */}
            <ol aria-labelledby={col.id} className="relative flex flex-col gap-7 pl-9">
              <span
                aria-hidden="true"
                className="bg-accent/35 absolute top-2 bottom-2 left-[5px] w-px"
              />
              {col.steps.map(([n, t, d], k) => (
                <li key={n} className="group relative">
                  <span
                    aria-hidden="true"
                    className={
                      "border-accent group-hover:bg-accent absolute top-1.5 -left-9 size-[11px] rounded-full border-2 transition-colors " +
                      (k === col.steps.length - 1 ? "bg-accent" : "bg-canvas")
                    }
                  />
                  <p className="flex items-baseline gap-3">
                    <span className="text-accent font-mono text-xs">{n}</span>
                    <span className="text-lg font-medium">{t}</span>
                  </p>
                  <p className="text-muted mt-1 max-w-prose text-[15px]">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      {data && data.candidates.length > 0 && (
        <section aria-labelledby="talents">
          <SectionHead
            id="talents"
            title="Кандидаты в базе"
            link={{ href: "/register?role=employer", label: "Найти своих" }}
          >
            Работодатель видит категорию, результат теста, навыки и достижения. Имя и контакты
            откроются, только когда кандидат примет приглашение.
          </SectionHead>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.candidates.map((c, i) => (
              <CandidateTeaser key={i} c={c} />
            ))}
          </div>
        </section>
      )}

      <section
        aria-label="Навыки, которые проверяет тест"
        className="marquee-frame -mx-4 overflow-hidden py-1 sm:-mx-6"
      >
        <div className="marquee gap-3 pr-3">
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1 || undefined} className="flex shrink-0 gap-3">
              {ticker.map((t) => (
                <li
                  key={t}
                  className="border-accent/30 bg-surface text-accent flex items-center gap-3 rounded-full border px-4 py-2 font-mono text-sm whitespace-nowrap"
                >
                  <span aria-hidden="true" className="bg-accent size-1.5 rounded-full" />
                  {t}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>

      {data && data.vacancies.length > 0 && (
        <section aria-labelledby="jobs">
          <SectionHead
            id="jobs"
            title="Свежие вакансии"
            link={{ href: "/register?role=candidate", label: "Все вакансии" }}
          >
            Зарплата указана в каждой. Откликнуться можно с категорией той же специализации.
          </SectionHead>
          <ul className="list-frame reveal">
            {data.vacancies.map((v) => (
              <li
                key={v.id}
                className="group hover:bg-subtle flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center sm:gap-6 sm:p-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="group-hover:text-accent text-lg font-medium transition-colors">
                    {v.title}
                  </p>
                  <p className="text-muted mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
                    {v.company}
                    {v.verified && (
                      <span className="text-ok inline-flex items-center gap-1">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 16 16"
                          className="size-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m3.5 8.5 3 3 6-7" />
                        </svg>
                        проверена
                      </span>
                    )}
                    <span>
                      · {formatTitle(v.format)}
                      {v.city ? `, ${v.city}` : ""}
                    </span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="solid">{categoryTitle(v.specialization, v.grade)}</Badge>
                    {v.stack.map((s) => (
                      <Badge key={s} tone="gray">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
                <p className="text-accent font-mono text-lg whitespace-nowrap sm:text-right">
                  {salaryRange(v.salaryFrom, v.salaryTo)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        aria-label="Принципы"
        className="reveal bg-primary text-on-primary relative overflow-hidden rounded-[var(--radius-blank)]"
      >
        <ul className="divide-on-primary/20 relative z-10 grid max-sm:divide-y sm:grid-cols-3 sm:divide-x">
          {[
            ["Зарплата всегда видна", "Вилка обязательна в каждом приглашении и вакансии."],
            [
              "Контакты под защитой",
              "Работодатель видит ваши контакты только после вашего согласия.",
            ],
            [
              "Тест, который не сольют",
              "Банк параметризованных шаблонов, адаптивность и уникальный вариант на каждую попытку.",
            ],
          ].map(([t, d]) => (
            <li key={t} className="p-6 sm:p-8">
              <p className="text-xl font-medium text-balance">{t}</p>
              <p className="text-on-primary/85 mt-2 text-sm">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="showcase-promo"
        className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16"
      >
        <div className="reveal">
          <h2 id="showcase-promo" className="h-display text-2xl text-balance sm:text-3xl">
            Профиль, который говорит за вас
          </h2>
          <p className="text-muted mt-4 max-w-prose text-pretty">
            Закрепите на витрине до пяти главных сертификатов и дипломов, расскажите об опыте работы
            — работодатель увидит всё на одной странице ещё до первого звонка.
          </p>
          <ul className="mt-6 flex flex-col gap-3 text-[15px]">
            {[
              "Витрина из 5 сертификатов с отметкой о проверке",
              "Опыт работы на таймлайне",
              "Навыки, подтверждённые тестом",
              "Контакты скрыты до вашего согласия",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="border-accent mt-1.5 size-2 shrink-0 rounded-full border-2"
                />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <ProfileMock />
      </section>

      <section aria-labelledby="blog">
        <SectionHead id="blog" title="Блог" link={{ href: "/blog", label: "Все статьи" }}>
          Как устроены тест и подбор — и как получить от платформы больше.
        </SectionHead>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.slice(0, 3).map((a, i) => (
            <ArticleCard
              key={a.slug}
              a={a}
              className={i === 2 ? "reveal sm:max-lg:hidden" : "reveal"}
            />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="cta"
        className="blank reveal relative overflow-hidden px-5 py-10 sm:px-10 sm:py-14"
      >
        <Pattern
          seed="cta-fsp"
          className="text-accent/50 pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 md:block"
        />
        <div className="relative max-w-xl">
          <h2 id="cta" className="h-display text-3xl text-balance sm:text-4xl">
            Покажите уровень один раз — дальше пусть ищут вас
          </h2>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/register?role=candidate" size="lg">
              Пройти тест
            </ButtonLink>
            <ButtonLink href="/register?role=employer" size="lg" variant="secondary">
              Найти специалиста
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}

function Hero() {
  const track = "M8 8 H180 a24 24 0 0 1 24 24 V120 a24 24 0 0 0 24 24 H392";
  return (
    <section className="blank relative overflow-hidden px-5 py-10 sm:px-10 sm:py-14">
      <div className="relative z-10 max-w-3xl">
        <h1 className="h-display rise text-4xl leading-[1.05] text-balance sm:text-6xl">
          Работодатель находит вас сам — по результату теста, а не по резюме
        </h1>
        <p className="rise text-muted mt-6 max-w-xl text-lg text-pretty" style={delay(120)}>
          Пройдите тест на выбранный грейд, получите подтверждённую категорию, а достижения в
          соревнованиях ФСП поднимут вас выше в выдаче.
        </p>
        <div className="rise mt-8 flex flex-wrap gap-3" style={delay(220)}>
          <ButtonLink href="/register?role=candidate" size="lg">
            Я кандидат
          </ButtonLink>
          <ButtonLink href="/register?role=employer" size="lg" variant="secondary">
            Я работодатель
          </ButtonLink>
        </div>
        <p
          className="label-mono rise text-muted mt-10 flex items-center gap-2.5 sm:mt-12"
          style={delay(320)}
        >
          <span aria-hidden="true" className="relative flex size-2">
            <span className="ping bg-red absolute inset-0 rounded-full" />
            <span className="bg-red relative size-2 rounded-full" />
          </span>
          Обратный подбор · модель LHH
        </p>
      </div>
      {/* The booklet track draws itself, then a dot keeps running along it. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 152"
        fill="none"
        className="text-accent/70 pointer-events-none absolute right-6 bottom-6 hidden w-[34%] lg:block"
      >
        <path
          d={track}
          stroke="currentColor"
          strokeWidth="1.2"
          pathLength={1}
          className="pattern-draw"
        />
        <circle cx="8" cy="8" r="3.5" fill="currentColor" />
        <circle cx="392" cy="144" r="3.5" fill="currentColor" />
        <circle r="4" className="motion-only fill-red">
          <animateMotion dur="6s" repeatCount="indefinite" begin="1.6s" path={track} />
        </circle>
      </svg>
      <div className="float absolute top-8 right-8 hidden lg:block">
        <Logo width={150} className="flex" />
      </div>
      <Pattern
        seed="hero-mobile"
        className="text-accent/60 pointer-events-none mt-10 -mb-4 h-28 w-full lg:hidden"
        animated
      />
    </section>
  );
}

function SectionHead({
  id,
  title,
  link,
  children,
}: {
  id: string;
  title: string;
  link: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 id={id} className="h-display text-2xl sm:text-3xl">
          {title}
        </h2>
        <p className="text-muted mt-2 max-w-prose text-pretty">{children}</p>
      </div>
      <Link
        href={link.href}
        className="group text-accent inline-flex shrink-0 items-center gap-1.5 text-sm font-medium"
      >
        {link.label}
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-3.5 transition-transform group-hover:translate-x-1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      </Link>
    </div>
  );
}

/** Illustration of a candidate profile: a stylised showcase, not real data. */
function ProfileMock() {
  const certs = [
    { seed: "mock-1", place: "1 место", title: "Кубок России" },
    { seed: "mock-2", place: "финал", title: "Чемпионат России" },
    { seed: "mock-3", place: "3 место", title: "Хакатон ФСП" },
  ];
  return (
    <div aria-hidden="true" className="reveal relative min-w-0">
      <div className="blank flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-on-primary flex size-12 items-center justify-center rounded-full font-mono">
            МС
          </div>
          <div className="min-w-0 flex-1">
            <span className="bg-fg/15 block h-3.5 w-full max-w-36 rounded-full" />
            <span className="bg-fg/10 mt-2 block h-2.5 w-24 rounded-full" />
          </div>
          <Badge tone="solid">Backend · Middle</Badge>
        </div>
        <p className="label-mono">Витрина</p>
        <div className="grid grid-cols-3 gap-2.5">
          {certs.map((c, i) => (
            <div
              key={c.seed}
              className="rise border-accent/30 bg-surface min-w-0 overflow-hidden rounded-xl border"
              style={delay(200 + i * 120)}
            >
              <Pattern seed={c.seed} className="bg-subtle text-accent aspect-[4/3] w-full" />
              <div className="p-2">
                <p className="truncate text-xs font-medium">{c.title}</p>
                <p className="text-accent font-mono text-[10px]">{c.place}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="label-mono">Опыт</p>
        <ol className="relative flex flex-col gap-3 pl-6">
          <span className="bg-accent/35 absolute top-1.5 bottom-1.5 left-[4px] w-px" />
          {[0, 1].map((k) => (
            <li key={k} className="relative">
              <span
                className={`border-accent absolute top-1 -left-6 size-[9px] rounded-full border-2 ${k === 0 ? "bg-accent" : "bg-surface"}`}
              />
              <span className="bg-fg/15 block h-3 w-40 rounded-full" />
              <span className="bg-fg/10 mt-1.5 block h-2.5 w-28 rounded-full" />
            </li>
          ))}
        </ol>
        <p className="border-accent/15 text-muted flex items-center gap-2 border-t pt-3 text-sm">
          <LockIcon />
          Контакты — после согласия
        </p>
      </div>
    </div>
  );
}
