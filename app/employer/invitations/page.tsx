import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/invitations/status";
import { PageTitle } from "@/components/ui/blank";
import { cn } from "@/components/ui/cn";
import { dateTime, salaryRange } from "@/lib/format";
import { requireEmployer } from "@/server/http/guard";
import { STATUS_TITLES, type InvitationStatus } from "@/server/invitations/fsm";
import { listForEmployer } from "@/server/services/invitations";

export const metadata: Metadata = { title: "Приглашения" };
export const dynamic = "force-dynamic";

const FILTERS: (InvitationStatus | "all")[] = ["all", "sent", "viewed", "accepted", "declined", "withdrawn", "expired"];

export default async function EmployerInvitations({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const st = FILTERS.includes(status as InvitationStatus) && status !== "all" ? (status as InvitationStatus) : undefined;
  const me = await requireEmployer();
  const items = await listForEmployer(me.employerId, st);
  return (
    <div>
      <PageTitle kicker="Работодатель" title="Приглашения">
        Статусы: отправлено → просмотрено → принято или отклонено. Контакты кандидата открываются после принятия.
      </PageTitle>
      <nav aria-label="Фильтр по статусу" className="mb-5 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link key={f} href={f === "all" ? "/employer/invitations" : `/employer/invitations?status=${f}`} aria-current={(st ?? "all") === f ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", (st ?? "all") === f ? "border-violet bg-violet text-white" : "border-gray hover:border-violet/50")}>
            {f === "all" ? "Все" : STATUS_TITLES[f]}
          </Link>
        ))}
      </nav>
      {!items.length && <p className="text-muted">Приглашений нет.</p>}
      <ul className="flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.id}>
            <Link href={`/employer/invitations/${i.id}`} className="blank flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition-colors hover:bg-violet-50/50">
              <span className="font-medium">{i.candidateName}</span>
              <span className="text-sm text-muted">{i.title}</span>
              <span className="font-mono text-xs text-muted">{salaryRange(i.salaryFrom, i.salaryTo)}</span>
              <span className="ml-auto flex items-center gap-3">
                <span className="font-mono text-xs text-muted">{dateTime(i.createdAt)}</span>
                <StatusBadge status={i.status} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
