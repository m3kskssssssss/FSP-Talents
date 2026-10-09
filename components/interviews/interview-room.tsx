"use client";

import "@livekit/components-styles";
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useDataChannel,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIsDesktop } from "@/components/layout/desktop-only";
import { CodeEditor } from "@/components/test/code-editor";
import { Button } from "@/components/ui/button";
import { chipState } from "@/components/ui/chip";
import { cn } from "@/components/ui/cn";
import { Field, Notice } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";
import { INTERVIEW_CODE_MAX } from "@/server/schemas/interviews";
import { LocalTime } from "./local-time";
import { phaseOf } from "./status";

type Language = "python" | "javascript" | "sql";
type Role = "candidate" | "employer";
export type RoomInterview = {
  id: string;
  chatId: string;
  status: "scheduled" | "cancelled" | "done";
  durationMin: number;
  task: string | null;
  language: string;
  code: string;
  rating?: number | null;
  notes?: string | null;
  opensAt: string;
  closesAt: string;
};
type CodeState = { code: string; language: Language };

const LANGUAGES: { id: Language; label: string }[] = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "sql", label: "SQL" },
];
const asLanguage = (l: string): Language =>
  LANGUAGES.some((x) => x.id === l) ? (l as Language) : "python";
const SAVE_DELAY_MS = 1200;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** "через 2 ч 5 мин" until the room opens. */
function until(target: Date, now: Date) {
  const min = Math.max(1, Math.ceil((target.getTime() - now.getTime()) / 60_000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  return ["через", d && `${d} дн`, h && `${h} ч`, m && `${m} мин`].filter(Boolean).join(" ");
}

/**
 * The interview page body: the video call (LiveKit) next to a shared code
 * editor, plus cancel and, for the employer, the private verdict. The editor
 * syncs live over the room's data channel and is saved to the server so a
 * late joiner (or a reload) gets the current code.
 */
export function InterviewRoom({ interview, role }: { interview: RoomInterview; role: Role }) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  const phase = phaseOf(interview, now);
  const live = interview.status === "scheduled" && phase !== "missed";

  const [conn, setConn] = useState<{ url: string; token: string } | null>(null);
  const [joining, setJoining] = useState(false);
  const [left, setLeft] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<CodeState>({
    code: interview.code,
    language: asLanguage(interview.language),
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  /** The last text that came from the other side: the editor echoes it back through onChange. */
  const remoteRef = useRef<string | null>(null);
  const sendRef = useRef<((s: CodeState) => void) | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (s: CodeState) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaveState("saving");
        try {
          await api(`/api/v1/interviews/${interview.id}/code`, { method: "PUT", body: s });
          setSaveState("saved");
        } catch {
          setSaveState("error");
        }
      }, SAVE_DELAY_MS);
    },
    [interview.id],
  );
  useEffect(() => () => void (saveTimer.current && clearTimeout(saveTimer.current)), []);

  function localChange(next: CodeState) {
    setState(next);
    if (next.code.length > INTERVIEW_CODE_MAX) return;
    sendRef.current?.(next);
    save(next);
  }

  const onRemote = useCallback((s: CodeState) => {
    remoteRef.current = s.code;
    setState({ code: s.code, language: asLanguage(s.language) });
  }, []);

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const [c, fresh] = await Promise.all([
        api<{ url: string; token: string }>(`/api/v1/interviews/${interview.id}/token`, {
          method: "POST",
        }),
        api<RoomInterview>(`/api/v1/interviews/${interview.id}`),
      ]);
      onRemote({ code: fresh.code, language: asLanguage(fresh.language) });
      setLeft(false);
      setConn(c);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось подключиться. Попробуйте ещё раз.");
    } finally {
      setJoining(false);
    }
  }

  async function cancel() {
    if (!window.confirm("Отменить собеседование? Вторая сторона получит уведомление.")) return;
    setError(null);
    try {
      await api(`/api/v1/interviews/${interview.id}/cancel`, { method: "POST" });
      setConn(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось отменить");
    }
  }

  const tooLong = state.code.length > INTERVIEW_CODE_MAX;

  return (
    <div className="flex flex-col gap-6">
      {interview.status === "cancelled" && <Notice tone="error">Собеседование отменено.</Notice>}
      {interview.status === "done" && (
        <Notice tone="ok">Собеседование завершено. Ниже — код, который получился.</Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section
          aria-label="Видеосвязь"
          className="bg-code text-code-fg flex h-[22rem] flex-col overflow-hidden rounded-[var(--radius-blank)] sm:h-[28rem] lg:h-[36rem]"
        >
          {conn ? (
            <LiveKitRoom
              serverUrl={conn.url}
              token={conn.token}
              connect
              video
              audio
              data-lk-theme="default"
              className="interview-video flex min-h-0 flex-1 flex-col"
              onDisconnected={() => {
                setConn(null);
                setLeft(true);
              }}
              onError={(e) => setError(`Ошибка видеосвязи: ${e.message}`)}
              onMediaDeviceFailure={() =>
                setError(
                  "Нет доступа к камере или микрофону. Разрешите его в настройках браузера — собеседник вас пока не видит или не слышит.",
                )
              }
            >
              <Stage />
              <ControlBar variation="minimal" controls={{ chat: false, settings: false }} />
              <RoomAudioRenderer />
              <CodeSync sendRef={sendRef} stateRef={stateRef} onRemote={onRemote} />
            </LiveKitRoom>
          ) : (
            <Lobby
              phase={phase}
              opensAt={interview.opensAt}
              now={now}
              left={left}
              joining={joining}
              onJoin={join}
            />
          )}
        </section>

        <section aria-label="Общий редактор кода" className="flex min-w-0 flex-col gap-3">
          {interview.task && (
            <div className="blank p-4">
              <h2 className="label-mono mb-2">Задание</h2>
              <p className="text-[15px] text-pretty whitespace-pre-wrap">{interview.task}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Язык" className="flex flex-wrap gap-1.5">
              {LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  disabled={!live}
                  aria-pressed={state.language === l.id}
                  onClick={() => localChange({ ...state, language: l.id })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm disabled:cursor-not-allowed",
                    chipState(state.language === l.id),
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <span className="text-muted ml-auto font-mono text-xs" aria-live="polite">
              {tooLong
                ? `Больше ${INTERVIEW_CODE_MAX} символов — не сохраняется`
                : !live
                  ? "Только чтение"
                  : conn
                    ? "Видно обоим"
                    : saveState === "saving"
                      ? "Сохраняем…"
                      : saveState === "error"
                        ? "Не сохранено"
                        : saveState === "saved"
                          ? "Сохранено"
                          : "Синхронизация — после подключения"}
            </span>
          </div>
          <div className="h-[22rem] min-h-0 sm:h-[26rem] lg:flex-1">
            {live ? (
              <CodeEditor
                value={state.code}
                language={state.language}
                label="Общий редактор кода"
                onChange={(v) => {
                  if (v === remoteRef.current) return;
                  remoteRef.current = null;
                  localChange({ ...stateRef.current, code: v });
                }}
              />
            ) : (
              <pre className="bg-code text-code-fg border-accent/40 h-full overflow-auto rounded-xl border p-4 font-mono text-[13.5px]">
                {state.code || "Код не писали"}
              </pre>
            )}
          </div>
        </section>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/${role}/chats?chat=${interview.chatId}`}
          className="text-accent text-sm hover:underline"
        >
          Открыть чат
        </Link>
        {interview.status === "scheduled" && phase !== "missed" && (
          <Button variant="danger" size="sm" className="ml-auto" onClick={cancel}>
            Отменить собеседование
          </Button>
        )}
      </div>

      {role === "employer" && interview.status !== "cancelled" && phase !== "upcoming" && (
        <Verdict interview={interview} onSaved={() => router.refresh()} />
      )}
    </div>
  );
}

function Lobby({
  phase,
  opensAt,
  now,
  left,
  joining,
  onJoin,
}: {
  phase: ReturnType<typeof phaseOf>;
  opensAt: string;
  now: Date;
  left: boolean;
  joining: boolean;
  onJoin: () => void;
}) {
  const blocked = useIsDesktop() === false;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-10 opacity-60"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="m16 10 5-3v10l-5-3" />
      </svg>
      {phase === "upcoming" && (
        <>
          <p className="text-lg text-balance">
            Комната откроется <LocalTime value={opensAt} />
          </p>
          <p className="font-mono text-sm opacity-70">{until(new Date(opensAt), now)}</p>
        </>
      )}
      {phase === "open" && (
        <>
          <p className="text-lg text-balance">{left ? "Вы вышли из комнаты" : "Комната открыта"}</p>
          <p className="max-w-sm text-sm text-pretty opacity-70">
            Браузер попросит доступ к камере и микрофону. Лучше подключаться в наушниках.
          </p>
          {blocked && (
            // the call area is dark in both themes, so plain text instead of a Notice
            <p role="alert" className="max-w-sm text-sm font-medium text-pretty">
              Только с компьютера: к собеседованию подключаются с ПК, там камера и общий редактор
              кода.
            </p>
          )}
          <Button size="lg" onClick={onJoin} disabled={joining || blocked}>
            {joining ? "Подключаемся…" : left ? "Вернуться" : "Подключиться"}
          </Button>
        </>
      )}
      {phase === "missed" && <p className="text-lg">Время собеседования прошло</p>}
      {(phase === "cancelled" || phase === "done") && (
        <p className="text-lg">{phase === "done" ? "Звонок завершён" : "Звонок отменён"}</p>
      )}
    </div>
  );
}

function Stage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <div className="min-h-0 flex-1">
      <GridLayout tracks={tracks}>
        <ParticipantTile />
      </GridLayout>
    </div>
  );
}

/**
 * Bridges the editor and the room's data channel: sends local edits, applies
 * the other side's and hands the current code to whoever joins after us.
 */
function CodeSync({
  sendRef,
  stateRef,
  onRemote,
}: {
  sendRef: React.RefObject<((s: CodeState) => void) | null>;
  stateRef: React.RefObject<CodeState>;
  onRemote: (s: CodeState) => void;
}) {
  const room = useRoomContext();
  const { send } = useDataChannel("code", (msg) => {
    try {
      const s = JSON.parse(decoder.decode(msg.payload)) as CodeState;
      if (typeof s.code === "string" && typeof s.language === "string") onRemote(s);
    } catch {
      // not ours
    }
  });
  useEffect(() => {
    const push = (s: CodeState) =>
      void send(encoder.encode(JSON.stringify(s)), { reliable: true }).catch(() => {});
    sendRef.current = push;
    const onJoin = () => push(stateRef.current);
    room.on(RoomEvent.ParticipantConnected, onJoin);
    return () => {
      sendRef.current = null;
      room.off(RoomEvent.ParticipantConnected, onJoin);
    };
  }, [send, room, sendRef, stateRef]);
  return null;
}

function Verdict({ interview, onSaved }: { interview: RoomInterview; onSaved: () => void }) {
  const [rating, setRating] = useState<number | null>(interview.rating ?? null);
  const [notes, setNotes] = useState(interview.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const done = interview.status === "done";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setError("Поставьте оценку от 1 до 5");
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/interviews/${interview.id}/finish`, { body: { rating, notes } });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="blank flex flex-col gap-4 p-5 sm:p-6" noValidate>
      <div>
        <h2 className="label-mono">Ваша оценка</h2>
        <p className="text-muted mt-1 text-sm">
          Видна только вашей компании, кандидат её не увидит.
        </p>
      </div>
      <div role="group" aria-label="Оценка от 1 до 5" className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={rating === n}
            onClick={() => {
              setRating(n);
              setSaved(false);
            }}
            className={cn("size-10 rounded-full border font-mono", chipState(rating === n))}
          >
            {n}
          </button>
        ))}
      </div>
      <Field label="Заметки" htmlFor="notes">
        <textarea
          id="notes"
          className="input min-h-28"
          maxLength={4000}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
          placeholder="Сильные стороны, что смутило, следующий шаг"
        />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      {saved && <Notice tone="ok">Сохранено</Notice>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Сохраняем…" : done ? "Сохранить оценку" : "Завершить собеседование"}
      </Button>
    </form>
  );
}
