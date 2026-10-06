import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageTitle } from "@/components/ui/blank";
import { cn } from "@/components/ui/cn";
import { Notice } from "@/components/ui/field";
import { dateTime, salaryRange } from "@/lib/format";
import { requireActor } from "@/server/http/guard";
import { REPUTATION_TITLES } from "@/server/invitations/reputation";
import { listReports, REPORT_REASONS } from "@/server/services/reputation";
import { Resolve } from "./resolve";

export const metadata: Metadata = { title: "Жалобы на работодателей" };
export const dynamic = "force-dynamic";

const STATUS = { open: ["ждёт решения", "warn"], confirmed: ["подтверждена", "red"], dismissed: ["отклонена", "gray"] } as const;

export default async function Reports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  await requireActor("admin");
  const st = status === "confirmed" || status === "dismissed" || status === "all" ? status : "open";
  const items = await listReports(st === "all" ? undefined : st);
  return (
    <div>
      <PageTitle kicker="Модерация" title="Жалобы на работодателей">
        Защита от фиктивных вакансий: кандидаты жалуются на приглашения, открытые жалобы и низкая доля принятых приглашений сразу урезают дневной лимит компании. Подтверждённая
        жалоба переводит компанию в статус риска, который видят кандидаты. Блокировок без решения человека нет.
      </PageTitle>
      <nav className="mb-5 flex gap-2 text-sm">
        {(["open", "confirmed", "dismissed", "all"] as const).map((s) => (
          <Link key={s} href={`/admin/reports?status=${s}`} className={cn("rounded-full border px-3 py-1", st === s ? "border-violet bg-violet text-white" : "border-gray")}>
            {s === "all" ? "Все" : STATUS[s][0]}
          </Link>
        ))}
      </nav>
      {!items.length && <Notice>Жалоб нет.</Notice>}
      <ul className="flex flex-col gap-3">
        {items.map((r) => (
          <li key={r.id} className="blank flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{r.company}</p>
              <Badge tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge>
              <Badge tone={r.reputation.level === "risky" ? "red" : "gray"}>{REPUTATION_TITLES[r.reputation.level]}</Badge>
              <span className="ml-auto text-xs text-muted">{dateTime(r.createdAt)}</span>
            </div>
            <p className="text-sm">
              <span className="font-medium">{REPORT_REASONS[r.reason]}</span>
              {r.invitationTitle && (
                <span className="text-muted">
                  {" "}
                  · «{r.invitationTitle}», {salaryRange(r.salaryFrom, r.salaryTo)}
                </span>
              )}
            </p>
            {r.note && <p className="text-sm whitespace-pre-line">{r.note}</p>}
            <p className="text-xs text-muted">
              Приглашений за 90 дней: {r.reputation.sent}, принято {r.reputation.accepted}, отклонено {r.reputation.declined}; лимит сейчас {r.reputation.dailyQuota} в сутки.
            </p>
            {r.status === "open" && <Resolve id={r.id} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
