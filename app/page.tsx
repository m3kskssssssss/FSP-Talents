import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Track } from "@/components/ui/track";

const candidateSteps = [
  ["01", "Профиль", "Заполните профиль или загрузите PDF-резюме — мы разберём его автоматически."],
  ["02", "Грейд и тест", "Выберите грейд и пройдите адаптивный тест: задания подстраиваются под вас, вариант уникален."],
  ["03", "Категория", "Получите категорию «специализация · грейд». Только после этого вас увидят работодатели."],
  ["04", "Приглашения", "Работодатели сами пишут вам с вилкой зарплаты. Контакты открываются, только если вы согласитесь."],
];
const employerSteps = [
  ["01", "Потребность", "Заполните форму или вставьте текст вакансии — система разберёт его в структуру."],
  ["02", "Подборка", "Кандидаты из нужной категории, ранжированные по результату теста, стеку и достижениям ФСП, с доводами «за» и «против»."],
  ["03", "Уточнение", "Фильтры поверх подборки — исходный список не теряется."],
  ["04", "Приглашение", "Пригласите конкретного человека с вилкой. Приняв, он откроет вам контакты."],
];

export default function Home() {
  return (
    <div className="flex flex-col gap-16 sm:gap-20">
      <section className="blank relative overflow-hidden px-5 py-10 sm:px-10 sm:py-14">
        <div className="relative z-10 max-w-3xl">
          <h1 className="h-display text-4xl leading-[1.05] text-balance sm:text-6xl">
            Работодатель находит вас сам — по результату теста, а не по резюме
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-muted">
            Пройдите тест на выбранный грейд, получите подтверждённую категорию, а достижения в соревнованиях ФСП поднимут вас выше
            в выдаче.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/register?role=candidate" size="lg">
              Я кандидат
            </ButtonLink>
            <ButtonLink href="/register?role=employer" size="lg" variant="secondary">
              Я работодатель
            </ButtonLink>
          </div>
          <p className="label-mono mt-10 text-muted sm:mt-12">Обратный подбор · модель LHH</p>
        </div>
        <Track className="pointer-events-none absolute right-6 bottom-6 hidden w-[34%] text-accent/60 lg:block" />
        <Logo width={150} className="absolute top-8 right-8 hidden lg:flex" />
      </section>

      <section aria-label="Как это работает" className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        {[
          { id: "how-cand", title: "Кандидату", steps: candidateSteps },
          { id: "how-emp", title: "Работодателю", steps: employerSteps },
        ].map((col) => (
          <div key={col.id}>
            <h2 id={col.id} className="h-display mb-8 text-2xl sm:text-3xl">
              {col.title}
            </h2>
            {/* The brand "track": one thin line through the steps, a dot at each stop. */}
            <ol aria-labelledby={col.id} className="relative flex flex-col gap-7 pl-9">
              <span aria-hidden="true" className="absolute top-2 bottom-2 left-[5px] w-px bg-accent/35" />
              {col.steps.map(([n, t, d], k) => (
                <li key={n} className="relative">
                  <span
                    aria-hidden="true"
                    className={
                      "absolute top-1.5 -left-9 size-[11px] rounded-full border-2 border-accent " +
                      (k === col.steps.length - 1 ? "bg-accent" : "bg-canvas")
                    }
                  />
                  <p className="flex items-baseline gap-3">
                    <span className="font-mono text-xs text-accent">{n}</span>
                    <span className="text-lg font-medium">{t}</span>
                  </p>
                  <p className="mt-1 max-w-prose text-[15px] text-muted">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      <section aria-label="Принципы" className="rounded-[var(--radius-blank)] bg-primary text-on-primary">
        <ul className="grid divide-on-primary/20 sm:grid-cols-3 sm:divide-x max-sm:divide-y">
          {[
            ["Зарплата всегда видна", "Вилка обязательна в каждом приглашении и вакансии."],
            ["Контакты под защитой", "Работодатель видит ваши контакты только после вашего согласия."],
            ["Тест, который не сольют", "Банк параметризованных шаблонов, адаптивность и уникальный вариант на каждую попытку."],
          ].map(([t, d]) => (
            <li key={t} className="p-6 sm:p-8">
              <p className="text-xl font-medium text-balance">{t}</p>
              <p className="mt-2 text-sm text-on-primary/85">{d}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
