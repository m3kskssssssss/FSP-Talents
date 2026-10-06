import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
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
    <div className="flex flex-col gap-16">
      <section className="blank relative overflow-hidden px-5 py-10 sm:px-10 sm:py-14">
        <div className="relative z-10 max-w-3xl">
          <p className="label-mono mb-5">Обратный подбор · модель LHH</p>
          <h1 className="h-display text-4xl leading-[1.05] sm:text-6xl">
            Работодатель находит вас сам — по результату теста, а не по резюме
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
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
        </div>
        <Track className="pointer-events-none absolute right-0 bottom-0 hidden w-[46%] text-violet/70 md:block" />
        <Image
          src="/brand/logo_02w.svg"
          alt=""
          width={150}
          height={50}
          className="absolute top-8 right-8 hidden opacity-90 lg:block"
        />
      </section>

      <section aria-labelledby="how-cand" className="grid gap-10 lg:grid-cols-2">
        {[
          { id: "how-cand", title: "Кандидату", steps: candidateSteps },
          { id: "how-emp", title: "Работодателю", steps: employerSteps },
        ].map((col) => (
          <div key={col.id}>
            <h2 id={col.id} className="h-display mb-6 text-2xl sm:text-3xl">
              {col.title}
            </h2>
            <ol className="flex flex-col gap-3">
              {col.steps.map(([n, t, d]) => (
                <li key={n} className="blank flex gap-4 p-4">
                  <span className="font-mono text-sm text-violet">{n}</span>
                  <div>
                    <p className="font-medium">{t}</p>
                    <p className="mt-1 text-sm text-muted">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Принципы">
        {[
          ["Зарплата всегда видна", "Вилка обязательна в каждом приглашении и вакансии."],
          ["Контакты под защитой", "Работодатель видит ваши контакты только после вашего согласия."],
          ["Тест, который не сольют", "Банк параметризованных шаблонов, адаптивность и уникальный вариант на каждую попытку."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-[var(--radius-blank)] bg-violet p-6 text-white">
            <p className="font-mono text-[11px] tracking-[0.12em] text-white/70 uppercase">Принцип</p>
            <p className="mt-3 text-xl font-medium">{t}</p>
            <p className="mt-2 text-sm text-white/85">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
