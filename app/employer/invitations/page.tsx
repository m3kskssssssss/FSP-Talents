import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/invitations/status";
import { PageTitle } from "@/components/ui/blank";
import { EmptyState } from "@/components/ui/empty";
import { cn } from "@/components/ui/cn";
import { dateTime, salaryRange } from "@/lib/format";
import { requireEmployer } from "@/server/http/guard";
import { STATUS_TITLES, type InvitationStatus } from "@/server/invitations/fsm";
import { listForEmployer } from "@/server/services/invitations";
import { chipState } from "@/components/ui/chip";

export const metadata: Metadata = { title: "Приглашения" };
export const dynamic = "force-dynamic";

const FILTERS: (InvitationStatus | "all")[] = [
  "all",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
];

export default async function EmployerInvitations({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const st =
    FILTERS.includes(status as InvitationStatus) && status !== "all"
      ? (status as InvitationStatus)
      : undefined;
  const me = await requireEmployer();
  const items = await listForEmployer(me.employerId, st);
  return (
    <div>
      <PageTitle title="Приглашения">
        Статусы: отправлено → просмотрено → принято или отклонено. Контакты кандидата открываются
        после принятия.
      </PageTitle>
      <nav aria-label="Фильтр по статусу" className="mb-5 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/employer/invitations" : `/employer/invitations?status=${f}`}
            aria-current={(st ?? "all") === f ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-sm", chipState((st ?? "all") === f))}
          >
            {f === "all" ? "Все" : STATUS_TITLES[f]}
          </Link>
        ))}
      </nav>
      {!items.length && (
        <EmptyState title={st ? "С этим статусом приглашений нет" : "Вы ещё никого не пригласили"}>
          {st
            ? "Выберите другой статус или «Все»."
            : "Откройте подборку по потребности или поиск по базе и пригласите кандидата с вилкой зарплаты."}
        </EmptyState>
      )}
      {items.length > 0 && (
        <ul className="list-frame">
          {items.map((i) => (
            <li key={i.id}>
              <Link
                href={`/employer/invitations/${i.id}`}
                className="hover:bg-subtle flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 transition-colors sm:px-5"
              >
                <span className="font-medium">{i.candidateName}</span>
                <span className="text-muted text-sm">{i.title}</span>
                <span className="text-muted font-mono text-xs">
                  {salaryRange(i.salaryFrom, i.salaryTo)}
                </span>
                <span className="ml-auto flex items-center gap-3">
                  <span className="text-muted font-mono text-xs">{dateTime(i.createdAt)}</span>
                  <StatusBadge status={i.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
