import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/invitations/status";
import { PageTitle } from "@/components/ui/blank";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { dateTime, salaryRange } from "@/lib/format";
import { requireCandidate } from "@/server/http/guard";
import { listForCandidate } from "@/server/services/invitations";

export const metadata: Metadata = { title: "Приглашения" };
export const dynamic = "force-dynamic";

export default async function CandidateInvitations() {
  const me = await requireCandidate();
  const items = await listForCandidate(me.profileId);
  return (
    <div>
      <PageTitle title="Приглашения">
        Компании приглашают вас сами. Ваши контакты откроются компании, только если вы примете
        приглашение.
      </PageTitle>
      {!items.length && (
        <EmptyState
          title="Приглашений пока нет"
          action={
            <ButtonLink href="/candidate/test" variant="secondary">
              Перейти к тестам
            </ButtonLink>
          }
        >
          Приглашения появятся, когда у вас будет категория по результатам теста: работодатели ищут
          кандидатов именно по ней.
        </EmptyState>
      )}
      {items.length > 0 && (
        <ul className="list-frame">
          {items.map(({ inv, company }) => (
            <li key={inv.id}>
              <Link
                href={`/candidate/invitations/${inv.id}`}
                className="hover:bg-subtle flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 transition-colors sm:px-5"
              >
                <span className="font-medium">{company}</span>
                <span className="text-sm">{inv.title}</span>
                <span className="text-accent font-mono text-sm">
                  {salaryRange(inv.salaryFrom, inv.salaryTo)}
                </span>
                <span className="ml-auto flex items-center gap-3">
                  <span className="text-muted font-mono text-xs">{dateTime(inv.createdAt)}</span>
                  <StatusBadge status={inv.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
