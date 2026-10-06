import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/invitations/status";
import { PageTitle } from "@/components/ui/blank";
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
      <PageTitle kicker="Кандидат" title="Приглашения">
        Компании приглашают вас сами. Ваши контакты откроются компании, только если вы примете приглашение.
      </PageTitle>
      {!items.length && <p className="text-muted">Приглашений пока нет. Они появятся, когда у вас будет категория по результатам теста.</p>}
      <ul className="flex flex-col gap-2">
        {items.map(({ inv, company }) => (
          <li key={inv.id}>
            <Link href={`/candidate/invitations/${inv.id}`} className="blank flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition-colors hover:bg-violet-50/50">
              <span className="font-medium">{company}</span>
              <span className="text-sm">{inv.title}</span>
              <span className="font-mono text-sm text-violet">{salaryRange(inv.salaryFrom, inv.salaryTo)}</span>
              <span className="ml-auto flex items-center gap-3">
                <span className="font-mono text-xs text-muted">{dateTime(inv.createdAt)}</span>
                <StatusBadge status={inv.status} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
