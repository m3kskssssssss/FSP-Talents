"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CertificateCard,
  ShowcaseGrid,
  SOURCE_BADGE,
  STAGE_TITLES,
  type ShowcaseItem,
} from "@/components/candidate/showcase";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { chipState } from "@/components/ui/chip";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/empty";
import { Notice } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";

const MAX = 5;

/** Pick up to five achievements for the showcase and set their order. */
export function ShowcaseEditor({
  achievements,
  initial,
}: {
  achievements: ShowcaseItem[];
  initial: string[];
}) {
  const router = useRouter();
  const known = new Set(achievements.map((a) => a.id));
  const [ids, setIds] = useState(() => initial.filter((id) => known.has(id)));
  const [saved, setSaved] = useState(ids);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const byId = new Map(achievements.map((a) => [a.id, a]));
  const dirty = ids.join() !== saved.join();
  const full = ids.length >= MAX;

  const toggle = (id: string) => {
    setMsg(null);
    setIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < MAX ? [...cur, id] : cur,
    );
  };
  const move = (i: number, by: -1 | 1) =>
    setIds((cur) => {
      const next = [...cur];
      const j = i + by;
      if (j < 0 || j >= next.length) return cur;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/v1/me/showcase", { method: "PUT", body: { ids } });
      setSaved(ids);
      setMsg({ tone: "ok", text: "Витрина сохранена — работодатели видят её в вашем профиле." });
      router.refresh();
    } catch (e) {
      setMsg({
        tone: "error",
        text:
          e instanceof ApiError ? e.message : "Не удалось сохранить витрину. Попробуйте ещё раз.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!achievements.length)
    return (
      <EmptyState
        title="Пока нечего показать"
        action={
          <Link href="/candidate/fsp" className={buttonClass("primary", "sm")}>
            Добавить сертификат
          </Link>
        }
      >
        Загрузите сертификат или диплом, привяжите ФСП ID или добавьте достижение вручную — и
        выберите до пяти лучших для витрины.
      </EmptyState>
    );

  return (
    <div className="flex flex-col gap-6">
      <ShowcaseGrid>
        {ids.map((id, i) => (
          <CertificateCard key={id} item={byId.get(id)!} className="rise">
            <div className="border-accent/15 mt-2 flex items-center gap-1 border-t pt-2">
              <span className="text-muted font-mono text-xs">#{i + 1}</span>
              <span className="ml-auto flex gap-0.5">
                <IconButton
                  label="Сдвинуть левее"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  d="M10 3 5 8l5 5"
                />
                <IconButton
                  label="Сдвинуть правее"
                  onClick={() => move(i, 1)}
                  disabled={i === ids.length - 1}
                  d="m6 3 5 5-5 5"
                />
                <IconButton
                  label="Убрать с витрины"
                  onClick={() => toggle(id)}
                  d="M4 4l8 8M12 4 4 12"
                />
              </span>
            </div>
          </CertificateCard>
        ))}
        {Array.from({ length: MAX - ids.length }, (_, k) => (
          <div
            key={k}
            className="border-accent/35 text-muted flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-center text-sm"
          >
            <span
              aria-hidden="true"
              className="border-accent/35 text-accent flex size-8 items-center justify-center rounded-full border font-mono"
            >
              {ids.length + k + 1}
            </span>
            Свободное место
          </div>
        ))}
      </ShowcaseGrid>

      <div>
        <p className="text-muted mb-3 text-sm">
          Выберите до {MAX} — выбрано{" "}
          <span className="text-accent font-mono">
            {ids.length}/{MAX}
          </span>
          . Порядок на витрине — порядок выбора, его можно менять стрелками.
        </p>
        <ul className="list-frame">
          {achievements.map((a) => {
            const on = ids.includes(a.id);
            return (
              <li
                key={a.id}
                className="hover:bg-subtle flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors"
              >
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-medium">{a.competition}</p>
                  <p className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-mono text-xs">{a.year}</span>
                    {STAGE_TITLES[a.stage]}
                    {a.place ? <Badge tone="red">{a.place} место</Badge> : null}
                    <Badge tone={SOURCE_BADGE[a.source][1]}>{SOURCE_BADGE[a.source][0]}</Badge>
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={!on && full}
                  title={!on && full ? `На витрине уже ${MAX} — уберите одну карточку` : undefined}
                  onClick={() => toggle(a.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50",
                    chipState(on),
                  )}
                >
                  {on ? "На витрине ✓" : "На витрину"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={busy || !dirty}>
          {busy ? "Сохраняем…" : "Сохранить витрину"}
        </Button>
        {dirty && <span className="text-warn text-sm">Есть несохранённые изменения</span>}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  d,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  d: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="text-accent hover:bg-accent-soft rounded-full p-1.5 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={d} />
      </svg>
    </button>
  );
}
