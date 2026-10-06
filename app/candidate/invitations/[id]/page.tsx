import type { Metadata } from "next";
import { History, StatusBadge } from "@/components/invitations/status";
import { Badge } from "@/components/ui/badge";
import { Blank, PageTitle } from "@/components/ui/blank";
import { Notice } from "@/components/ui/field";
import { date, formatTitle, salaryRange } from "@/lib/format";
import { requireCandidate } from "@/server/http/guard";
import { getForCandidate } from "@/server/services/invitations";
import { REPUTATION_TITLES } from "@/server/invitations/reputation";
import { Decision } from "./decision";
import { Report } from "./report";

export const metadata: Metadata = { title: "Приглашение" };
export const dynamic = "force-dynamic";

export default async function CandidateInvitation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireCandidate();
  const { invitation: inv, company, reputation: rep, reported, history } = await getForCandidate(me.profileId, me.userId, id);
  const pct = (x: number | null) => (x === null ? "мало данных" : `${Math.round(x * 100)}%`);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle kicker={company.name} title={inv.title}>
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge status={inv.status} />
          {company.verified && <Badge tone="ok">компания проверена</Badge>}
        </span>
      </PageTitle>
      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <Blank label="Предложение">
          <p className="font-mono text-3xl text-violet">{salaryRange(inv.salaryFrom, inv.salaryTo)}</p>
          <p className="mt-1 text-sm text-muted">в месяц · {formatTitle(inv.format)}</p>
          <p className="mt-4 text-[15px] whitespace-pre-line">{inv.description}</p>
          {company.about && (
            <div className="mt-5 border-t border-violet/15 pt-4 text-sm">
              <p className="label-mono mb-1">О компании</p>
              <p>{company.about}</p>
              {company.site && (
                <a className="link" href={company.site} target="_blank" rel="noreferrer noopener">
                  {company.site}
                </a>
              )}
            </div>
          )}
        </Blank>
        <div className="flex flex-col gap-6">
          <Blank label="Статус">
            <History events={history} />
          </Blank>
          <Blank label="Репутация компании">
            <p className={rep.level === "risky" ? "font-medium text-red" : "font-medium"}>{REPUTATION_TITLES[rep.level]}</p>
            {rep.reasons.length > 0 && <p className="text-sm text-red">{rep.reasons.join("; ")}</p>}
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Приглашений за 90 дней</dt>
              <dd className="font-mono">{rep.sent}</dd>
              <dt className="text-muted">Принимают</dt>
              <dd className="font-mono">{pct(rep.acceptRate)}</dd>
              <dt className="text-muted">Отвечают на приглашения</dt>
              <dd className="font-mono">{pct(rep.responseRate)}</dd>
              <dt className="text-muted">На платформе с</dt>
              <dd className="font-mono">{date(rep.since)}</dd>
            </dl>
            <p className="mt-2 text-xs text-muted">Считается по истории приглашений компании на платформе и жалобам кандидатов.</p>
          </Blank>
        </div>
      </div>
      {inv.status === "viewed" ? (
        <Decision id={inv.id} />
      ) : inv.status === "accepted" ? (
        <Notice tone="ok">Вы приняли приглашение — компания видит ваши контакты и свяжется с вами.</Notice>
      ) : null}
      <Report id={inv.id} reported={reported} />
    </div>
  );
}
