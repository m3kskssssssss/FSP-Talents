"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/empty";
import { ApiError, api } from "@/lib/api-client";

type Role = "candidate" | "employer";
type ChatItem = {
  id: string;
  title: string;
  with: string;
  lastMessageAt: string;
  unread: number;
  last: { body: string; author: string } | null;
};
type Message = { id: string; author: Role | "system"; body: string; createdAt: string };

const LIST_POLL_MS = 15_000;
const THREAD_POLL_MS = 4_000;

const time = (d: string) => {
  const t = new Date(d);
  const today = new Date().toDateString() === t.toDateString();
  return today
    ? t.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : t.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
};

/** Calls `fn` every `ms` while the tab is visible. */
function usePoll(fn: () => void, ms: number, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => document.visibilityState === "visible" && fn(), ms);
    return () => clearInterval(id);
  }, [fn, ms, enabled]);
}

/**
 * Employer–candidate chat: conversation list and thread. Two panes from `md`,
 * one at a time on phones. The same component lives on the "Чаты" page and in
 * the header modal (`compact`). New messages arrive by polling.
 */
export function ChatApp({
  role,
  initialChatId,
  compact = false,
}: {
  role: Role;
  initialChatId?: string | null;
  compact?: boolean;
}) {
  const [chats, setChats] = useState<ChatItem[] | null>(null);
  const [active, setActive] = useState<string | null>(initialChatId ?? null);
  const [listError, setListError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      const r = await api<{ items: ChatItem[] }>("/api/v1/chats");
      setChats(r.items);
      setListError(null);
    } catch (e) {
      setListError(e instanceof ApiError ? e.message : "Не удалось загрузить чаты");
    }
  }, []);
  useEffect(() => void loadList(), [loadList]);
  usePoll(loadList, LIST_POLL_MS);

  // On wide screens open the newest chat right away.
  useEffect(() => {
    if (active || !chats?.length || !window.matchMedia("(min-width: 768px)").matches) return;
    setActive(chats[0]!.id);
  }, [chats, active]);

  const height = compact
    ? "h-[calc(100dvh-57px)] sm:h-[70vh]"
    : "h-[calc(100dvh-14rem)] min-h-[28rem]";
  if (listError && !chats) return <p className="text-danger p-5 text-sm">{listError}</p>;
  if (!chats) return <p className="text-muted p-5 text-sm">Загружаем чаты…</p>;
  if (!chats.length)
    return (
      <div className="p-4 sm:p-5">
        <EmptyState title="Чатов пока нет">
          {role === "candidate"
            ? "Чат с компанией откроется, когда вы примете её приглашение или компания примет ваш отклик."
            : "Чат с кандидатом откроется, когда он примет ваше приглашение или вы примете его отклик."}
        </EmptyState>
      </div>
    );

  const current = chats.find((c) => c.id === active) ?? null;
  return (
    <div
      className={cn("grid md:grid-cols-[17rem_1fr]", height, !compact && "list-frame divide-y-0")}
    >
      <ul
        className={cn("border-accent/15 overflow-y-auto md:border-r", current && "max-md:hidden")}
        aria-label="Чаты"
      >
        {chats.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => {
                setActive(c.id);
                setChats(
                  (list) => list?.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)) ?? null,
                );
              }}
              aria-current={c.id === active ? "true" : undefined}
              className={cn(
                "border-accent/10 flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left transition-colors",
                c.id === active ? "bg-accent-soft" : "hover:bg-subtle",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">{c.with}</span>
                <span className="text-muted shrink-0 font-mono text-[11px]">
                  {time(c.lastMessageAt)}
                </span>
              </span>
              <span className="text-accent truncate text-xs">{c.title}</span>
              <span className="flex items-center gap-2">
                <span className="text-muted min-w-0 flex-1 truncate text-sm">
                  {c.last ? (c.last.author === role ? "Вы: " : "") + c.last.body : "—"}
                </span>
                {c.unread > 0 && (
                  <span
                    className="bg-red text-on-primary flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[11px]"
                    aria-label={`${c.unread} непрочитанных`}
                  >
                    {c.unread}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {current ? (
        <Thread
          key={current.id}
          chat={current}
          role={role}
          onBack={() => setActive(null)}
          onSent={loadList}
        />
      ) : (
        <div className="text-muted hidden items-center justify-center p-6 text-sm md:flex">
          Выберите чат слева
        </div>
      )}
    </div>
  );
}

function Thread({
  chat,
  role,
  onBack,
  onSent,
}: {
  chat: ChatItem;
  role: Role;
  onBack: () => void;
  onSent: () => void;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const count = messages?.length ?? 0;

  const load = useCallback(async () => {
    try {
      const r = await api<{ messages: Message[] }>(`/api/v1/chats/${chat.id}/messages`);
      setMessages(r.messages);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить сообщения");
    }
  }, [chat.id]);
  useEffect(() => void load(), [load]);
  usePoll(load, THREAD_POLL_MS);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const m = await api<Message>(`/api/v1/chats/${chat.id}/messages`, { body: { body } });
      setMessages((list) => [...(list ?? []), m]);
      setText("");
      onSent();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Сообщение не отправлено. Попробуйте ещё раз.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-label={`Чат: ${chat.with}`} className="flex min-h-0 flex-col">
      <header className="border-accent/15 flex items-center gap-2 border-b px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="К списку чатов"
          className="text-accent hover:bg-accent-soft rounded-full p-1.5 md:hidden"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 3 5 8l5 5" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="truncate font-medium">{chat.with}</p>
          <p className="text-accent truncate text-xs">{chat.title}</p>
        </div>
      </header>
      <div
        ref={scroller}
        className="bg-subtle/60 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-4 sm:px-4"
        aria-live="polite"
      >
        {!messages && <p className="text-muted m-auto text-sm">Загружаем…</p>}
        {messages?.map((m) =>
          m.author === "system" ? (
            <p
              key={m.id}
              className="label-mono text-muted mx-auto my-2 max-w-sm text-center tracking-normal text-pretty normal-case"
            >
              {m.body}
            </p>
          ) : (
            <div
              key={m.id}
              className={cn(
                "chat-bubble flex max-w-[85%] flex-col",
                m.author === role ? "items-end self-end" : "items-start self-start",
              )}
            >
              <p
                className={cn(
                  "rounded-2xl px-3.5 py-2 text-[15px] break-words whitespace-pre-wrap",
                  m.author === role
                    ? "bg-primary text-on-primary rounded-br-md"
                    : "bg-surface border-accent/20 rounded-bl-md border",
                )}
              >
                {m.body}
              </p>
              <time dateTime={m.createdAt} className="text-muted mt-0.5 px-1 font-mono text-[10px]">
                {time(m.createdAt)}
              </time>
            </div>
          ),
        )}
      </div>
      <form onSubmit={send} className="border-accent/15 flex items-end gap-2 border-t p-2.5 sm:p-3">
        <label htmlFor={`msg-${chat.id}`} className="sr-only">
          Сообщение
        </label>
        <textarea
          id={`msg-${chat.id}`}
          rows={1}
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Сообщение… (Enter — отправить, Shift+Enter — новая строка)"
          className="input max-h-36 min-h-11 flex-1 resize-none"
        />
        <Button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label="Отправить"
          className="size-11 shrink-0 px-0"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12h15M13 6l6 6-6 6" />
          </svg>
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-danger px-4 pb-2 text-xs">
          {error}
        </p>
      )}
    </section>
  );
}

export function OpenChatsLink({ role, className }: { role: Role; className?: string }) {
  return (
    <Link href={`/${role}/chats`} className={cn("text-accent text-sm hover:underline", className)}>
      Открыть во вкладке
    </Link>
  );
}
