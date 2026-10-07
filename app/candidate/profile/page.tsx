import type { Metadata } from "next";
import Link from "next/link";
import { ProfileHero } from "@/components/candidate/profile-hero";
import { toProfileValues } from "@/components/candidate/values";
import { Blank } from "@/components/ui/blank";
import { buttonClass } from "@/components/ui/button";
import { formatTitle, salaryRange } from "@/lib/format";
import { requireCandidate } from "@/server/http/guard";
import { getMyProfile } from "@/server/services/candidate";
import { ProfileEditor } from "./editor";
import { ExperienceEditor } from "./experience-editor";
import { ShowcaseEditor } from "./showcase-editor";

export const metadata: Metadata = { title: "Профиль" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await requireCandidate();
  const p = await getMyProfile(me.profileId, me.userId);
  const prof = p.profile;
  const best = p.categories.reduce<number | null>(
    (m, c) => (m === null || c.score > m ? c.score : m),
    null,
  );
  const confirmedSkills = p.skills.filter((s) => s.source === "test_confirmed").length;
  const achievements = p.achievements.map((a) => ({
    id: a.id,
    competition: a.competition,
    discipline: a.discipline,
    stage: a.stage,
    year: a.year,
    place: a.place,
    source: a.source,
    certificate: (a.evidence as { certificate?: boolean } | null)?.certificate === true,
  }));
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <ProfileHero
        seed={me.profileId}
        name={prof.fullName || "Ваш профиль"}
        facts={[
          prof.city,
          prof.experienceYears !== null && `опыт ${prof.experienceYears} г.`,
          prof.workFormat && formatTitle(prof.workFormat),
          prof.salaryExpectFrom
            ? `ожидания ${salaryRange(prof.salaryExpectFrom, prof.salaryExpectTo)}`
            : null,
        ]}
        categories={p.categories.map((c) => ({ specialization: c.specialization, grade: c.grade }))}
        stats={[
          { value: best !== null ? `${best.toFixed(1)}/30` : "—", label: "лучший тест" },
          { value: String(p.achievements.length), label: "достижений" },
          {
            value: `${prof.showcase.filter((id) => achievements.some((a) => a.id === id)).length}/5`,
            label: "на витрине",
          },
          { value: String(confirmedSkills), label: "навыков ✓ тестом" },
        ]}
      >
        <Link href="/candidate/fsp" className={buttonClass("secondary", "sm")}>
          Добавить сертификат
        </Link>
        <a href="/api/v1/me/resume.pdf" className={buttonClass("ghost", "sm")}>
          Резюме PDF
        </a>
      </ProfileHero>

      <Blank
        label="Витрина сертификатов"
        aside={<span className="text-muted text-sm">до 5 штук</span>}
      >
        <p className="text-muted -mt-1 mb-5 max-w-prose text-sm text-pretty">
          Работодатель видит витрину сразу под вашей категорией. Закрепите самые сильные дипломы и
          сертификаты — подтверждённые реестром ФСП или организатором весят больше.
        </p>
        <ShowcaseEditor achievements={achievements} initial={prof.showcase} />
      </Blank>

      <Blank label="Опыт работы">
        <ExperienceEditor initial={prof.workHistory} />
      </Blank>

      <Blank label="Основные данные">
        <ProfileEditor initial={toProfileValues(p)} />
      </Blank>
    </div>
  );
}
