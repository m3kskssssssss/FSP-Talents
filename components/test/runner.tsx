"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Notice } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";
import { gradeTitle, specTitle } from "@/lib/format";
import { Runner, type Output, type RunLang } from "@/lib/runner";
import type { AttemptState } from "@/server/services/testing";
import { CodeEditor } from "./code-editor";
import { Statement } from "./statement";
import { chipState } from "@/components/ui/chip";

type State = Omit<AttemptState, "startedAt" | "deadlineAt" | "serverNow"> & {
  startedAt: string;
  deadlineAt: string;
  serverNow: string;
};
type EventType = "visibility_hidden" | "blur" | "copy" | "paste" | "fullscreen_exit" | "fullscreen_enter" | "bulk_insert" | "context_menu";
type ExampleRow = { label: string; ok: boolean; got: string; expected: string };

const BULK_PASTE_CHARS = 200;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const show = (v: unknown) => {
  const s = JSON.stringify(v);
  return s && s.length > 160 ? s.slice(0, 160) + "…" : String(s);
};

export function TestRunner({ initial }: { initial: State }) {
  const [state, setState] = useState<State>(initial);
  const [skew] = useState(() => new Date(initial.serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [fullscreen, setFullscreen] = useState(false);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<RunLang>("python");
  const [code, setCode] = useState<Record<string, string>>({});
  const [calc, setCalc] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [examples, setExamples] = useState<ExampleRow[] | null>(null);
  const [sqlPreview, setSqlPreview] = useState<{ columns: string[]; rows: unknown[][] } | null>(null);
  const [runNote, setRunNote] = useState<string | null>(null);
  const runner = useRef<Runner | null>(null);
  const queue = useRef<{ type: EventType; itemId?: string; payload?: Record<string, number | string | boolean> }[]>([]);
  const itemStart = useRef(Date.now());

  const [fsSupported, setFsSupported] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setFsSupported(Boolean(document.fullscreenEnabled));
    setMounted(true);
  }, []);
  const cur = state.current;
  const view = cur?.view;
  const itemId = cur?.itemId;
  const deadline = new Date(state.deadlineAt).getTime();
  const left = Math.max(0, deadline - (now + skew));

  // ---------------------------------------------------------------- events journal
  const log = useCallback(
    (type: EventType, payload?: Record<string, number | string | boolean>) => {
      queue.current.push({ type, itemId, payload });
    },
    [itemId],
  );
  const flush = useCallback(async () => {
    const events = queue.current.splice(0, queue.current.length);
    if (!events.length) return;
    try {
      await api(`/api/v1/tests/attempts/${state.id}/events`, { body: { events } });
    } catch {
      queue.current.unshift(...events);
    }
  }, [state.id]);

  useEffect(() => {
    const t = setInterval(flush, 4000);
    return () => clearInterval(t);
  }, [flush]);

  useEffect(() => {
    const onVis = () => document.visibilityState === "hidden" && log("visibility_hidden");
    const onBlur = () => log("blur");
    const onFs = () => {
      const fs = Boolean(document.fullscreenElement);
      setFullscreen(fs);
      log(fs ? "fullscreen_enter" : "fullscreen_exit");
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [log]);

  // ---------------------------------------------------------------- timer
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0 && state.status === "in_progress") {
      void api<State>(`/api/v1/tests/attempts/${state.id}`).then((s) => {
        if (s.status !== "in_progress") window.location.href = `/candidate/attempts/${state.id}`;
      });
    }
  }, [left, state.id, state.status]);

  // ---------------------------------------------------------------- per-item reset
  useEffect(() => {
    itemStart.current = Date.now();
    setExamples(null);
    setSqlPreview(null);
    setRunNote(null);
    setCalc("");
    setSelected([]);
    setError(null);
    if (view?.kind === "code" && view.code && !view.code.languages.includes(lang as "python")) setLang(view.code.languages[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  useEffect(() => {
    runner.current = new Runner();
    return () => runner.current?.dispose();
  }, []);

  const editorLang: RunLang = view?.kind === "sql" ? "sql" : lang;
  const codeKey = `${itemId}:${editorLang}`;
  const currentCode = useMemo(() => {
    if (code[codeKey] !== undefined) return code[codeKey]!;
    if (view?.kind === "sql") return "SELECT\n  \nFROM \n";
    if (view?.code) return view.code.starters[lang as "python" | "javascript"] ?? "";
    return "";
  }, [code, codeKey, view, lang]);

  async function ensureEngine(l: RunLang) {
    if (l === "javascript") return;
    setRunNote(l === "python" ? "Загружаем Python (Pyodide)… первый запуск занимает до 20 секунд" : "Загружаем SQLite…");
    await runner.current!.warmup(l);
    setRunNote(null);
  }

  // ---------------------------------------------------------------- actions
  async function runExamples() {
    if (!view) return;
    setBusy("run");
    setError(null);
    try {
      await ensureEngine(editorLang);
      if (view.kind === "code" && view.code) {
        const r = await runner.current!.run(
          { lang: editorLang, code: currentCode, fnName: view.code.fn.name, inputs: view.code.examples.map((e) => e.args) },
          8000,
        );
        if (r.timedOut) return setError("Превышено время выполнения (8 с). Проверьте, нет ли бесконечного цикла.");
        if (r.compileError) return setError(r.compileError);
        setExamples(
          view.code.examples.map((e, i) => {
            const o = r.outputs?.[i] as Output | undefined;
            const ok = Boolean(o?.ok && same((o as { value: unknown }).value, e.expected));
            return {
              label: `${view.code!.fn.name}(${e.args.map(show).join(", ")})`,
              ok,
              got: o ? (o.ok ? show(o.value) : `ошибка: ${o.error}`) : "—",
              expected: show(e.expected),
            };
          }),
        );
      } else if (view.kind === "sql" && view.sql) {
        const r = await runner.current!.run({ lang: "sql", code: currentCode, schema: view.sql.schema, data: view.sql.publicData }, 8000);
        if (r.timedOut) return setError("Запрос выполнялся слишком долго");
        const res = r.result;
        if (!res || "error" in res) return setError(res && "error" in res ? res.error : "Ошибка запроса");
        setSqlPreview(res);
        const ok = same(res.rows, view.sql.expected.rows);
        setExamples([{ label: "Результат на открытых данных", ok, got: `${res.rows.length} строк`, expected: `${view.sql.expected.rows.length} строк` }]);
      }
    } finally {
      setBusy(null);
    }
  }

  async function submit(skipped = false) {
    if (!view || !itemId) return;
    setBusy(skipped ? "skip" : "submit");
    setError(null);
    try {
      await flush();
      let answer: unknown;
      if (!skipped) {
        if (view.kind === "code" || view.kind === "sql") {
          await ensureEngine(editorLang);
          const hidden = await api<{ inputs?: unknown[][]; data?: string; timeoutMs: number }>(
            `/api/v1/tests/attempts/${state.id}/items/${itemId}/hidden`,
            { method: "POST" },
          );
          if (view.kind === "code") {
            const r = await runner.current!.run(
              { lang: editorLang, code: currentCode, fnName: view.code!.fn.name, inputs: hidden.inputs ?? [] },
              hidden.timeoutMs,
            );
            const fail = (error: string) => (hidden.inputs ?? []).map(() => ({ ok: false as const, error }));
            const outputs = r.timedOut ? fail("timeout") : r.compileError ? fail(r.compileError.slice(0, 500)) : r.outputs!;
            answer = { kind: "code", language: editorLang, code: currentCode, outputs };
          } else {
            const r = await runner.current!.run({ lang: "sql", code: currentCode, schema: view.sql!.schema, data: hidden.data }, hidden.timeoutMs);
            answer = { kind: "sql", code: currentCode, result: r.timedOut ? { error: "timeout" } : r.result ?? { error: "no result" } };
          }
        } else if (view.kind === "calc") {
          if (!calc.trim()) {
            setBusy(null);
            return setError("Введите ответ или пропустите задание");
          }
          answer = { kind: "calc", value: calc };
        } else {
          if (!selected.length) {
            setBusy(null);
            return setError("Выберите вариант ответа или пропустите задание");
          }
          answer = { kind: "quiz", selected };
        }
      }
      const next = await api<State>(`/api/v1/tests/attempts/${state.id}/items/${itemId}/answer`, {
        body: { skipped, answer, timeMs: Date.now() - itemStart.current },
      });
      if (next.status !== "in_progress") {
        window.location.href = `/candidate/attempts/${state.id}`;
        return;
      }
      setState(next);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось отправить ответ, попробуйте ещё раз");
    } finally {
      setBusy(null);
    }
  }

  async function finishEarly() {
    if (!confirm("Завершить тест досрочно? Результат посчитается по уже отвеченным заданиям.")) return;
    await flush();
    await api(`/api/v1/tests/attempts/${state.id}/finish`, { method: "POST" });
    window.location.href = `/candidate/attempts/${state.id}`;
  }

  async function enterFullscreen() {
    setStarted(true);
    if (fsSupported) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        /* user denied; the overlay stays */
      }
    }
  }

  // ---------------------------------------------------------------- render
  const blocked = !started || (fsSupported && !fullscreen);
  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");

  if (!view) return <Notice>Загружаем задание…</Notice>;

  return (
    <div className="relative">
      {blocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/95 p-6 backdrop-blur">
          <div className="blank max-w-md p-6 text-center">
            <p className="label-mono mb-3">{started ? "Полноэкранный режим" : "Перед началом"}</p>
            <p className="mb-5">
              {started
                ? "Тест проходит только в полноэкранном режиме. Выход записан в журнал попытки — вернитесь, чтобы продолжить."
                : "Тест откроется в полноэкранном режиме. Копирование условия отключено; вставки и уходы со вкладки записываются в журнал. Таймер уже идёт."}
            </p>
            {!fsSupported && <p className="mb-4 text-sm text-muted">Ваш браузер не поддерживает полноэкранный режим — продолжим в обычном.</p>}
            <Button size="lg" onClick={enterFullscreen}>
              {started ? "Вернуться к тесту" : "Начать"}
            </Button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-accent/15 pb-3">
        <p className="label-mono">
          {specTitle(state.specialization)} · {gradeTitle(state.grade)}
        </p>
        <p className="text-sm">
          Задание <span className="font-mono">{state.answered + 1}</span>
          <span className="text-muted"> из {state.minItems}–{state.maxItems}</span>
        </p>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-accent-soft" aria-hidden="true">
          <div className="h-full bg-primary" style={{ width: `${Math.min(100, (state.answered / state.maxItems) * 100)}%` }} />
        </div>
        <span className="font-mono text-[11px] text-muted" title="Числа и данные в условии сгенерированы для вашей попытки">
          вариант только ваш
        </span>
        <p className={cn("ml-auto font-mono text-lg tabular-nums", left < 5 * 60_000 ? "text-danger" : "text-accent")} role="timer" aria-label="Осталось времени">
          {mounted ? `${mm}:${ss}` : "--:--"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section
          aria-label="Условие"
          className="blank p-5"
          onCopy={(e) => {
            e.preventDefault();
            log("copy");
          }}
          onCut={(e) => {
            e.preventDefault();
            log("copy");
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            log("context_menu");
          }}
        >
          <h1 className="h-display mb-3 text-2xl">{view.title}</h1>
          <Statement blocks={view.blocks} traps={view.traps} />
          {view.kind === "code" && view.code && (
            <div className="mt-4">
              <p className="label-mono mb-2">Примеры</p>
              <ul className="flex flex-col gap-1.5 font-mono text-[12.5px]">
                {view.code.examples.map((e, i) => (
                  <li key={i} className="rounded-lg bg-accent-soft/60 px-2.5 py-1.5 break-all">
                    {view.code!.fn.name}({e.args.map(show).join(", ")}) → {show(e.expected)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {view.kind === "sql" && view.sql && (
            <details className="mt-4" open>
              <summary className="label-mono cursor-pointer">Схема</summary>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-code p-3 font-mono text-[12px] text-code-fg">{view.sql.schema}</pre>
            </details>
          )}
        </section>

        <section aria-label="Ответ" className="flex flex-col gap-3">
          {(view.kind === "code" || view.kind === "sql") && (
            <>
              {view.kind === "code" && view.code && view.code.languages.length > 1 && (
                <div role="radiogroup" aria-label="Язык" className="flex gap-2">
                  {view.code.languages.map((l) => (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={lang === l}
                      onClick={() => setLang(l)}
                      className={cn("rounded-full border px-3 py-1 font-mono text-xs", chipState(lang === l))}
                    >
                      {l === "python" ? "Python" : "JavaScript"}
                    </button>
                  ))}
                </div>
              )}
              <div className="h-[340px]">
                <CodeEditor
                  key={codeKey}
                  value={currentCode}
                  language={editorLang}
                  label="Редактор решения"
                  onChange={(v) => setCode((c) => ({ ...c, [codeKey]: v }))}
                  onPaste={(len) => {
                    log("paste", { len });
                    if (len >= BULK_PASTE_CHARS) log("bulk_insert", { len });
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={runExamples} disabled={Boolean(busy)}>
                  {busy === "run" ? "Выполняем…" : "Запустить на примерах"}
                </Button>
              </div>
              {runNote && <Notice>{runNote}</Notice>}
              {examples && (
                <ul className="flex flex-col gap-1.5 text-sm" aria-live="polite">
                  {examples.map((r, i) => (
                    <li key={i} className={cn("rounded-lg border px-3 py-2 font-mono text-[12px] break-all", r.ok ? "border-ok/30 bg-ok/5" : "border-danger/30 bg-danger/5")}>
                      <span className="mr-2">{r.ok ? "✓" : "✗"}</span>
                      {r.label} → {r.got}
                      {!r.ok && <span className="block text-muted">ожидалось: {r.expected}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {sqlPreview && (
                <div className="overflow-x-auto">
                  <table className="font-mono text-[12px]">
                    <thead>
                      <tr>{sqlPreview.columns.map((c) => <th key={c} className="px-2 py-1 text-left text-accent">{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {sqlPreview.rows.slice(0, 20).map((r, i) => (
                        <tr key={i}>{r.map((v, k) => <td key={k} className="border-t border-line/50 px-2 py-1">{String(v)}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted">
                Примеры — только подсказка. При отправке решение запускается на скрытых данных, сгенерированных в момент отправки.
              </p>
            </>
          )}

          {view.kind === "calc" && view.calc && (
            <div className="blank flex flex-col gap-2 p-5">
              <label htmlFor="calc-answer" className="text-sm font-medium">
                Ваш ответ
              </label>
              <input id="calc-answer" className="input font-mono" inputMode="decimal" autoComplete="off" value={calc} onChange={(e) => setCalc(e.target.value)} />
              <p className="text-xs text-muted">{view.calc.hint}</p>
            </div>
          )}

          {view.kind === "quiz" && view.quiz && (
            <fieldset className="blank flex flex-col gap-2 p-5">
              <legend className="sr-only">Варианты ответа</legend>
              <p className="mb-1 text-sm text-muted">{view.quiz.multi ? "Выберите все подходящие варианты" : "Выберите один вариант"}</p>
              {view.quiz.options.map((o) => {
                const checked = selected.includes(o.id);
                return (
                  <label key={o.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5", checked ? "border-accent bg-accent-soft" : "border-line hover:border-accent/50")}>
                    <input
                      type={view.quiz!.multi ? "checkbox" : "radio"}
                      name="quiz"
                      className="mt-1 accent-primary"
                      checked={checked}
                      onChange={(e) =>
                        setSelected((s) => (view.quiz!.multi ? (e.target.checked ? [...s, o.id] : s.filter((x) => x !== o.id)) : [o.id]))
                      }
                    />
                    <span>{o.text}</span>
                  </label>
                );
              })}
            </fieldset>
          )}

          {error && <Notice tone="error">{error}</Notice>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="lg" onClick={() => submit(false)} disabled={Boolean(busy)}>
              {busy === "submit" ? "Проверяем…" : "Отправить ответ"}
            </Button>
            <Button variant="ghost" onClick={() => submit(true)} disabled={Boolean(busy)}>
              Пропустить
            </Button>
            <button type="button" onClick={finishEarly} className="ml-auto text-sm text-muted underline underline-offset-4 hover:text-danger">
              Завершить досрочно
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
