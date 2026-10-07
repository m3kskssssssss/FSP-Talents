"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChatApp, OpenChatsLink } from "@/components/chat/chat-app";
import { EmptyState } from "@/components/ui/empty";
import { Modal } from "@/components/ui/modal";
import { ApiError, api } from "@/lib/api-client";
import { dateTime } from "@/lib/format";

type Note = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const POLL_MS = 30_000;
const iconBtn = "relative rounded-full p-2 text-accent transition-colors hover:bg-accent-soft";

function Count({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="bg-red text-on-primary absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full font-mono text-[10px] font-medium">
      {n > 9 ? "9+" : n}
    </span>
  );
}

/**
 * Header buttons that open modals instead of pages: notifications for everyone,
 * chats for candidates and employers. Badges refresh every 30 s.
 */
export function HeaderPanels({
  role,
  unread,
}: {
  role: "candidate" | "employer" | "admin";
  unread: { notifications: number; chats: number };
}) {
  const [counts, setCounts] = useState(unread);
  const [open, setOpen] = useState<"notes" | "chats" | null>(null);
  const pathname = usePathname();
  const close = useCallback(() => setOpen(null), []);
  const notesRead = useCallback(() => setCounts((c) => ({ ...c, notifications: 0 })), []);

  useEffect(() => setCounts(unread), [unread]);
  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        setCounts(await api<{ notifications: number; chats: number }>("/api/v1/me/unread"));
      } catch {
        // badge refresh is best-effort
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const chatRole = role === "admin" ? null : role;
  const onChatsPage = chatRole && pathname.startsWith(`/${chatRole}/chats`);
  return (
    <>
      {chatRole && (
        <button
          type="button"
          className={iconBtn}
          onClick={() => setOpen("chats")}
          aria-haspopup="dialog"
          aria-label={`Чаты${counts.chats ? `: ${counts.chats} непрочитанных` : ""}`}
          hidden={!!onChatsPage}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          >
            <path d="M4 5h16v11H9l-5 4V5Z" />
            <path d="M8 9.5h8M8 12.5h5" strokeLinecap="round" />
          </svg>
          <Count n={counts.chats} />
        </button>
      )}
      <button
        type="button"
        className={iconBtn}
        onClick={() => setOpen("notes")}
        aria-haspopup="dialog"
        aria-label={`Уведомления${counts.notifications ? `: ${counts.notifications} новых` : ""}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        <Count n={counts.notifications} />
      </button>

      <Modal open={open === "notes"} onClose={close} title="Уведомления">
        <Notifications onRead={notesRead} />
      </Modal>
      {chatRole && (
        <Modal
          open={open === "chats"}
          onClose={close}
          title="Чаты"
          size="lg"
          aside={<OpenChatsLink role={chatRole} className="hidden sm:inline" />}
        >
          <ChatApp role={chatRole} compact />
        </Modal>
      )}
    </>
  );
}

function Notifications({ onRead }: { onRead: () => void }) {
  const router = useRouter();
  const [items, setItems] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api<{ items: Note[] }>("/api/v1/notifications");
        if (!alive) return;
        setItems(r.items);
        if (r.items.some((n) => !n.readAt)) {
          // shown = read; the highlight stays until the modal is closed
          await api("/api/v1/notifications/read", { body: {} });
          onRead();
          router.refresh();
        }
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : "Не удалось загрузить уведомления");
      }
    })();
    return () => {
      alive = false;
    };
  }, [onRead, router]);

  if (error) return <p className="text-danger p-5 text-sm">{error}</p>;
  if (!items) return <p className="text-muted p-5 text-sm">Загружаем…</p>;
  if (!items.length)
    return (
      <div className="p-4 sm:p-5">
        <EmptyState title="Событий пока нет">
          Здесь появятся новые приглашения, сообщения, ответы на отклики и результаты проверки.
        </EmptyState>
      </div>
    );
  return (
    <ul className="divide-accent/15 min-h-0 flex-1 divide-y overflow-y-auto">
      {items.map((n) => (
        <li key={n.id} className={n.readAt ? "" : "bg-accent-soft/60"}>
          {n.link ? (
            <Link
              href={n.link}
              className="hover:bg-subtle block px-4 py-3.5 transition-colors sm:px-5"
            >
              <NoteBody n={n} />
            </Link>
          ) : (
            <div className="px-4 py-3.5 sm:px-5">
              <NoteBody n={n} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function NoteBody({ n }: { n: Note }) {
  return (
    <>
      <p className="flex items-center gap-2 font-medium">
        {!n.readAt && <span className="bg-red size-2 shrink-0 rounded-full" aria-label="новое" />}
        {n.title}
      </p>
      {n.body && <p className="text-muted mt-0.5 text-sm text-pretty">{n.body}</p>}
      <p className="text-muted mt-1 font-mono text-xs">{dateTime(n.createdAt)}</p>
    </>
  );
}
