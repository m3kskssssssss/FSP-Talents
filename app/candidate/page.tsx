import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/invitations/status";
import { Badge } from "@/components/ui/badge";
import { Blank, PageTitle } from "@/components/ui/blank";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/field";
import { categoryTitle, date, formatTitle, salaryRange } from "@/lib/format";
import { requireCandidate } from "@/server/http/guard";
import { getMyProfile } from "@/server/services/candidate";
import { listForCandidate } from "@/server/services/invitations";

export const metadata: Metadata = { title: "Кабинет" };
export const dynamic = "force-dynamic";

const SOURCE = { fsp_registry: ["реестр ФСП", "ok"], organizer: ["организатор", "violet"], repo: ["репозиторий", "violet"], self: ["заявлено", "gray"] } as const;

export default async function CandidateHome() {
  const me = await requireCandidate();
  const p = await getMyProfile(me.profileId, me.userId);
  const invs = await listForCandidate(me.profileId);
  const open = invs.filter((i) => i.inv.status === "sent" || i.inv.status === "viewed");
  const prof = p.profile;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={prof.fullName || "Добро пожаловать"}>
        {[prof.city, prof.experienceYears !== null ? `опыт ${prof.experienceYears} г.` : null, formatTitle(prof.workFormat), prof.salaryExpectFrom ? `ожидания ${salaryRange(prof.salaryExpectFrom, prof.salaryExpectTo)}` : null].filter(Boolean).join(" · ")}
      </PageTitle>

      {!prof.onboardedAt && (
        <Notice>
          Заполните профиль и выберите грейд — это три коротких шага.{" "}
          <Link className="link" href="/candidate/onboarding">
            Начать
          </Link>
        </Notice>
      )}
      {prof.visibility === "hidden" && <Notice tone="error">Профиль скрыт — работодатели вас не видят. Включить можно в разделе «Приватность».</Notice>}

      <div className="grid gap-6 md:grid-cols-2">
        <Blank label="Категория">
          {p.categories.length ? (
            <ul className="flex flex-col gap-3">
              {p.categories.map((c) => (
                <li key={c.id}>
                  <p className="h-display text-2xl">{categoryTitle(c.specialization, c.grade)}</p>
                  <p className="text-sm text-muted">
                    Тест {c.score.toFixed(1)}/30 · присвоена {date(c.assignedAt)}
                    {c.trustLevel === "medium" && " · с пометкой"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Категории пока нет — без неё работодатели вас не видят. Пройдите тест на выбранный грейд.</p>
          )}
          <ButtonLink href="/candidate/test" className="mt-4">
            {p.categories.length ? "Тесты и пересдача" : "Пройти тест"}
          </ButtonLink>
        </Blank>

        <Blank label="Приглашения" aside={<Link className="link text-sm" href="/candidate/invitations">Все</Link>}>
          {!invs.length && <p className="text-muted">Пока нет. Компании приглашают кандидатов с категорией.</p>}
          {open.length > 0 && <p className="mb-2 text-sm">Ждут ответа: <strong>{open.length}</strong></p>}
          <ul className="flex flex-col gap-2">
            {invs.slice(0, 4).map(({ inv, company }) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link className="font-medium hover:text-accent" href={`/candidate/invitations/${inv.id}`}>
                  {company}
                </Link>
                <span className="text-muted">{inv.title}</span>
                <span className="ml-auto">
                  <StatusBadge status={inv.status} />
                </span>
              </li>
            ))}
          </ul>
        </Blank>
      </div>

      <Blank label="Навыки" aside={<Link className="link text-sm" href="/candidate/profile">Изменить профиль</Link>}>
        {!p.skills.length && <p className="text-sm text-muted">Навыки не указаны.</p>}
        <div className="flex flex-wrap gap-1.5">
          {p.skills.map((s) => (
            <Badge key={`${s.skill}-${s.source}`} tone={s.source === "test_confirmed" ? "ok" : "gray"} title={s.source === "test_confirmed" ? "Подтверждено тестом" : "Заявлено"}>
              {s.title} · {s.source === "test_confirmed" ? "тест ✓" : s.source === "resume" ? "резюме" : "заявлено"}
            </Badge>
          ))}
        </div>
      </Blank>

      <Blank label="Достижения ФСП" aside={<Link className="link text-sm" href="/candidate/fsp">ФСП ID и достижения</Link>}>
        {!p.achievements.length ? (
          <p className="text-sm text-muted">Достижений нет — это не мешает подбору, просто нет бонуса. Привяжите ФСП ID, чтобы подтянуть результаты из реестра.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {p.achievements.slice(0, 5).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted">{a.year}</span>
                {a.competition}
                {a.place ? <Badge tone="red">{a.place} место</Badge> : <Badge tone="gray">участие</Badge>}
                <Badge tone={SOURCE[a.source][1]}>{SOURCE[a.source][0]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Blank>

      <div className="flex flex-wrap gap-2">
        <a href="/api/v1/me/resume.pdf" className={buttonClass("secondary")}>
          Скачать резюме PDF
        </a>
        <Link href="/candidate/privacy" className={buttonClass("ghost")}>
          Приватность и согласия
        </Link>
      </div>
    </div>
  );
}
