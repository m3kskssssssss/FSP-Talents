import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui/blank";
import { EmptyState } from "@/components/ui/empty";
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
      <PageTitle title="События" />
      {!items.length && (
        <EmptyState title="Событий пока нет">
          Здесь появятся новые приглашения, ответы на них и результаты проверки.
        </EmptyState>
      )}
      {items.length > 0 && (
        <ul className="list-frame">
          {items.map((n) => (
            <li key={n.id} className={`px-4 py-3.5 sm:px-5 ${n.readAt ? "" : "bg-accent-soft/50"}`}>
              <p className="flex items-center gap-2 font-medium">
                {!n.readAt && <span className="bg-red size-2 rounded-full" aria-label="новое" />}
                {n.link ? (
                  <Link className="hover:text-accent" href={n.link}>
                    {n.title}
                  </Link>
                ) : (
                  n.title
                )}
              </p>
              {n.body && <p className="text-muted text-sm">{n.body}</p>}
              <p className="text-muted mt-1 font-mono text-xs">{dateTime(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
