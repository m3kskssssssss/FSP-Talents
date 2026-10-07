import type { Metadata } from "next";
import Link from "next/link";
import { ExperienceTimeline } from "@/components/candidate/experience";
import { ProfileHero } from "@/components/candidate/profile-hero";
import { CertificateCard, ShowcaseGrid } from "@/components/candidate/showcase";
import { Badge } from "@/components/ui/badge";
import { Blank } from "@/components/ui/blank";
import { buttonClass } from "@/components/ui/button";
import { categoryTitle, date, formatTitle, salaryRange } from "@/lib/format";
import { requireEmployer } from "@/server/http/guard";
import { candidateForEmployer } from "@/server/services/invitations";

export const metadata: Metadata = { title: "Кандидат" };
export const dynamic = "force-dynamic";

const STAGE = { regional: "региональный этап", district: "окружной этап", final: "финал" } as const;
const SOURCE = {
  fsp_registry: ["реестр ФСП", "ok"],
  organizer: ["организатор", "violet"],
  repo: ["репозиторий", "violet"],
  self: ["заявлено", "gray"],
} as const;

export default async function CandidateForEmployer({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const me = await requireEmployer();
  const c = await candidateForEmployer(me.employerId, me.userId, profileId);
  const best = c.categories.reduce<number | null>(
    (m, k) => (m === null || k.score > m ? k.score : m),
    c.unconfirmed?.score ?? null,
  );
  return (
    <div className="flex flex-col gap-6">
      <ProfileHero
        seed={c.profileId}
        name={c.displayName}
        facts={[
          c.city,
          c.experienceYears !== null && `опыт ${c.experienceYears} г.`,
          formatTitle(c.workFormat),
          `ожидания ${salaryRange(c.salaryExpect.from, c.salaryExpect.to)}`,
        ]}
        categories={[
          ...c.categories.map((k) => ({ specialization: k.specialization, grade: k.grade })),
          ...(c.unconfirmed
            ? [
                {
                  specialization: c.unconfirmed.specialization,
                  grade: c.unconfirmed.grade,
                  note: "не подтверждён",
                },
              ]
            : []),
        ]}
        stats={[
          { value: best !== null ? `${best.toFixed(1)}/30` : "—", label: "результат теста" },
          { value: String(c.achievements.length), label: "достижений ФСП" },
          { value: String(c.workHistory.length), label: "мест работы" },
          {
            value: String(c.skills.filter((s) => s.source === "test_confirmed").length),
            label: "навыков ✓ тестом",
          },
        ]}
      >
        {!c.contacts && (
          <Link
            href={`/employer/invite?profile=${c.profileId}`}
            className={buttonClass("primary", "sm")}
          >
            Пригласить
          </Link>
        )}
      </ProfileHero>
      {c.categories.length > 0 && (
        <p className="text-muted -mt-2 font-mono text-xs">
          {c.categories
            .map(
              (k) =>
                `${categoryTitle(k.specialization, k.grade)}: тест ${k.score.toFixed(1)}/30, присвоена ${date(k.assignedAt)}`,
            )
            .join(" · ")}
        </p>
      )}
      {c.showcase.length > 0 && (
        <Blank label="Витрина сертификатов">
          <ShowcaseGrid>
            {c.showcase.map((a) => (
              <CertificateCard key={a.id} item={a} className="reveal" />
            ))}
          </ShowcaseGrid>
        </Blank>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Blank label="О себе">
          <p className="text-[15px] whitespace-pre-line">{c.about || "—"}</p>
        </Blank>
        <Blank label="Контакты">
          {c.contacts ? (
            <ul className="flex flex-col gap-1 text-sm">
              {c.contacts.email && (
                <li>
                  Email:{" "}
                  <a className="link" href={`mailto:${c.contacts.email}`}>
                    {c.contacts.email}
                  </a>
                </li>
              )}
              {c.contacts.phone && (
                <li>
                  Телефон: <span className="font-mono">{c.contacts.phone}</span>
                </li>
              )}
              {c.contacts.telegram && (
                <li>
                  Telegram: <span className="font-mono">{c.contacts.telegram}</span>
                </li>
              )}
              {c.contacts.links?.map((l) => (
                <li key={l}>
                  <a className="link break-all" href={l} target="_blank" rel="noreferrer noopener">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className="text-muted text-sm">
                Контакты скрыты, пока кандидат не примет ваше приглашение.
              </p>
              <Link
                href={`/employer/invite?profile=${c.profileId}`}
                className={buttonClass("primary", "sm", "mt-3")}
              >
                Пригласить
              </Link>
            </>
          )}
        </Blank>
      </div>
      {c.workHistory.length > 0 && (
        <Blank label="Опыт работы">
          <ExperienceTimeline items={c.workHistory} />
        </Blank>
      )}
      <Blank label="Навыки">
        <div className="flex flex-wrap gap-1.5">
          {c.skills.map((s) => (
            <Badge
              key={`${s.skill}-${s.source}`}
              tone={s.source === "test_confirmed" ? "ok" : "gray"}
            >
              {s.title} ·{" "}
              {s.source === "test_confirmed"
                ? "тест ✓"
                : s.source === "resume"
                  ? "резюме"
                  : "заявлено"}
            </Badge>
          ))}
        </div>
      </Blank>
      <Blank label="Достижения ФСП">
        {!c.achievements.length && (
          <p className="text-muted text-sm">Истории в соревнованиях ФСП нет.</p>
        )}
        <ul className="flex flex-col gap-2 text-sm">
          {c.achievements.map((a, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="text-muted font-mono text-xs">{a.year}</span>
              <span>{a.competition}</span>
              <span className="text-muted">
                · {a.discipline}, {STAGE[a.stage]}
              </span>
              {a.place ? (
                <Badge tone="red">{a.place} место</Badge>
              ) : (
                <Badge tone="gray">участие</Badge>
              )}
              <Badge tone={SOURCE[a.source][1]}>{SOURCE[a.source][0]}</Badge>
            </li>
          ))}
        </ul>
      </Blank>
      {c.invitations.length > 0 && (
        <Blank label="Ваши приглашения">
          <ul className="flex flex-col gap-1 text-sm">
            {c.invitations.map((i) => (
              <li key={i.id}>
                <Link className="link" href={`/employer/invitations/${i.id}`}>
                  {i.title}
                </Link>{" "}
                — {i.statusTitle}
              </li>
            ))}
          </ul>
        </Blank>
      )}
    </div>
  );
}
