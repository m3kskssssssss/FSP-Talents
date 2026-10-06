import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui/blank";
import { dateTime } from "@/lib/format";
import { requireActor } from "@/server/http/guard";
import { listNotifications, markAllRead } from "@/server/services/notifications";

export const metadata: Metadata = { title: "Уведомления" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const me = await requireActor();
  const items = await listNotifications(me.userId, 50);
  await markAllRead(me.userId);
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle kicker="Уведомления" title="События" />
      {!items.length && <p className="text-muted">Пока ничего.</p>}
      <ul className="flex flex-col gap-2">
        {items.map((n) => (
          <li key={n.id} className={`blank p-4 ${n.readAt ? "" : "border-violet bg-violet-50/40"}`}>
            <p className="flex items-center gap-2 font-medium">
              {!n.readAt && <span className="size-2 rounded-full bg-red" aria-label="новое" />}
              {n.link ? <Link className="hover:text-violet" href={n.link}>{n.title}</Link> : n.title}
            </p>
            {n.body && <p className="text-sm text-muted">{n.body}</p>}
            <p className="mt-1 font-mono text-xs text-muted">{dateTime(n.createdAt)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
