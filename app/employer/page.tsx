import { and, count, eq, gte } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Blank, PageTitle } from "@/components/ui/blank";
import { ButtonLink } from "@/components/ui/button";
import { categoryTitle, salaryRange } from "@/lib/format";
import { db } from "@/server/db";
import { employers, invitations, shortlist } from "@/server/db/schema";
import { requireEmployer } from "@/server/http/guard";
import { listNeeds } from "@/server/services/needs";

export const metadata: Metadata = { title: "Кабинет работодателя" };
export const dynamic = "force-dynamic";

export default async function EmployerHome() {
  const me = await requireEmployer();
  const [company] = await db().select().from(employers).where(eq(employers.id, me.employerId));
  const needs = await listNeeds(me.employerId);
  const [inv] = await db().select({ n: count() }).from(invitations).where(eq(invitations.employerId, me.employerId));
  const [acc] = await db().select({ n: count() }).from(invitations).where(and(eq(invitations.employerId, me.employerId), eq(invitations.status, "accepted")));
  const [recent] = await db().select({ n: count() }).from(invitations).where(and(eq(invitations.employerId, me.employerId), gte(invitations.createdAt, new Date(Date.now() - 86400000))));
  const [sl] = await db().select({ n: count() }).from(shortlist).where(eq(shortlist.employerId, me.employerId));
  const stats = [
    ["Потребностей", needs.length, "/employer/needs"],
    ["В избранном", sl!.n, "/employer/shortlist"],
    ["Приглашений", inv!.n, "/employer/invitations"],
    ["Приняли", acc!.n, "/employer/invitations?status=accepted"],
  ] as const;
  return (
    <div className="flex flex-col gap-8">
      <PageTitle kicker="Кабинет работодателя" title={company!.companyName}>
        {company!.about}
      </PageTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([l, n, href]) => (
          <Link key={l} href={href} className="blank p-4 transition-colors hover:bg-violet-50">
            <p className="font-mono text-3xl text-violet">{n}</p>
            <p className="text-sm text-muted">{l}</p>
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/employer/needs/new" size="lg">
          Новая потребность
        </ButtonLink>
        <ButtonLink href="/employer/search" size="lg" variant="secondary">
          Поиск по базе
        </ButtonLink>
      </div>
      <Blank label="Потребности" aside={<span className="font-mono text-xs text-muted">приглашений за сутки: {recent!.n}</span>}>
        {!needs.length && <p className="text-muted">Создайте первую потребность — подборка появится сразу.</p>}
        <ul className="flex flex-col divide-y divide-violet/10">
          {needs.slice(0, 6).map(({ need, lastSearchId }) => (
            <li key={need.id} className="flex flex-wrap items-center gap-2 py-3">
              <Link href={`/employer/needs/${need.id}`} className="font-medium hover:text-violet">
                {need.title}
              </Link>
              <Badge tone="solid">{categoryTitle(need.specialization, need.grade)}</Badge>
              <Badge tone="gray">{salaryRange(need.salaryFrom, need.salaryTo)}</Badge>
              {lastSearchId && (
                <Link className="link ml-auto text-sm" href={`/employer/searches/${lastSearchId}`}>
                  Подборка →
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Blank>
    </div>
  );
}
