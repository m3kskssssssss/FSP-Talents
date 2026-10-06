import type { Metadata } from "next";
import Link from "next/link";
import { History, StatusBadge } from "@/components/invitations/status";
import { Blank, PageTitle } from "@/components/ui/blank";
import { buttonClass } from "@/components/ui/button";
import { formatTitle, salaryRange } from "@/lib/format";
import { requireEmployer } from "@/server/http/guard";
import { isOpen } from "@/server/invitations/fsm";
import { candidateForEmployer, getForEmployer } from "@/server/services/invitations";
import { WithdrawButton } from "./withdraw";

export const metadata: Metadata = { title: "Приглашение" };
export const dynamic = "force-dynamic";

export default async function EmployerInvitation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireEmployer();
  const { invitation: inv, history } = await getForEmployer(me.employerId, id);
  const cand = await candidateForEmployer(me.employerId, me.userId, inv.profileId);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle kicker="Приглашение" title={inv.title}>
        <span className="flex items-center gap-2">
          <StatusBadge status={inv.status} /> {cand.displayName}
        </span>
      </PageTitle>
      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <Blank label="Условия">
          <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Вилка</dt>
            <dd className="font-mono">{salaryRange(inv.salaryFrom, inv.salaryTo)}</dd>
            <dt className="text-muted">Формат</dt>
            <dd>{formatTitle(inv.format)}</dd>
            <dt className="text-muted">Задача</dt>
            <dd className="whitespace-pre-line">{inv.description}</dd>
          </dl>
        </Blank>
        <Blank label="Статус">
          <History events={history} />
        </Blank>
      </div>
      <Blank label="Контакты кандидата">
        {cand.contacts ? (
          <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
            {cand.contacts.email && (<><dt className="text-muted">Email</dt><dd><a className="link" href={`mailto:${cand.contacts.email}`}>{cand.contacts.email}</a></dd></>)}
            {cand.contacts.phone && (<><dt className="text-muted">Телефон</dt><dd className="font-mono">{cand.contacts.phone}</dd></>)}
            {cand.contacts.telegram && (<><dt className="text-muted">Telegram</dt><dd className="font-mono">{cand.contacts.telegram}</dd></>)}
            {cand.contacts.links?.length ? (<><dt className="text-muted">Ссылки</dt><dd className="flex flex-col">{cand.contacts.links.map((l) => <a key={l} className="link break-all" href={l} rel="noreferrer noopener" target="_blank">{l}</a>)}</dd></>) : null}
          </dl>
        ) : (
          <p className="text-sm text-muted">Контакты откроются, когда кандидат примет приглашение.</p>
        )}
      </Blank>
      <div className="flex flex-wrap gap-2">
        <Link href={`/employer/candidates/${inv.profileId}`} className={buttonClass("secondary")}>
          Профиль кандидата
        </Link>
        {isOpen(inv.status) && <WithdrawButton id={inv.id} />}
      </div>
    </div>
  );
}
