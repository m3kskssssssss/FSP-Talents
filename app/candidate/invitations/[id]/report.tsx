"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Notice } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";

const REASONS = [
  ["fake_vacancy", "Похоже на фиктивную вакансию"],
  ["salary_mismatch", "Условия не соответствуют заявленным"],
  ["spam", "Спам или массовая рассылка"],
  ["inappropriate", "Некорректное поведение"],
  ["other", "Другое"],
] as const;

export function Report({ id, reported }: { id: string; reported: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("fake_vacancy");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (reported) return <p className="text-sm text-muted">Вы пожаловались на это приглашение — модератор разберётся.</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start text-sm text-muted underline-offset-4 hover:text-red hover:underline">
        Пожаловаться на приглашение
      </button>
    );

  async function send() {
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/invitations/${id}/report`, { body: { reason, note: note || undefined } });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось отправить");
      setPending(false);
    }
  }

  return (
    <div className="blank flex flex-col gap-3 border-red/40 p-5">
      <p className="font-medium">Жалоба на приглашение</p>
      <fieldset className="flex flex-col gap-1.5 text-sm">
        <legend className="sr-only">Причина</legend>
        {REASONS.map(([v, t]) => (
          <label key={v} className="flex items-center gap-2">
            <input type="radio" name="reason" className="accent-violet" checked={reason === v} onChange={() => setReason(v)} />
            {t}
          </label>
        ))}
      </fieldset>
      <Field label="Подробности (необязательно)" htmlFor="report-note">
        <textarea id="report-note" className="input min-h-16" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="text-xs text-muted">Открытое приглашение будет отклонено. Жалобы снижают репутацию и дневной лимит приглашений компании; решение принимает модератор.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex gap-2">
        <Button variant="danger" disabled={pending} onClick={send}>
          Отправить жалобу
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
