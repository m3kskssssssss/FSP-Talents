"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Notice } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";

export function AnswerForm({ id, kind }: { id: string; kind: "exact" | "open" }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send(action: "answer" | "skip") {
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/me/challenges/${id}/${action}`, { body: action === "answer" ? { answer } : {} });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      <Field label={kind === "exact" ? "Ответ" : "Ваш подход к решению"} htmlFor="ch-answer">
        {kind === "exact" ? (
          <input id="ch-answer" className="input font-mono" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        ) : (
          <textarea id="ch-answer" className="input min-h-40" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        )}
      </Field>
      <p className="text-sm text-muted">
        {kind === "exact"
          ? "Ответ проверяется автоматически по эталону работодателя, отправить можно один раз."
          : "Ответ оценит работодатель от 0 до 3. Контакты при этом не передаются."}
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || !answer.trim()} onClick={() => send("answer")}>
          Отправить ответ
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => send("skip")}>
          Пропустить без штрафа
        </Button>
      </div>
    </div>
  );
}
