"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Notice } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";

export function Decision({ id }: { id: string }) {
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send(decision: "accept" | "decline") {
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/invitations/${id}/decision`, { body: { decision, reason: reason || undefined } });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="blank flex flex-col gap-4 p-5">
      <p className="text-sm">Если вы примете приглашение, компания увидит ваши контакты: email, телефон, Telegram и ссылки из профиля.</p>
      {declining && (
        <Field label="Причина отказа (необязательно)" htmlFor="reason">
          <textarea id="reason" className="input min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        {!declining ? (
          <>
            <Button size="lg" disabled={pending} onClick={() => send("accept")}>
              Принять и открыть контакты
            </Button>
            <Button size="lg" variant="secondary" disabled={pending} onClick={() => setDeclining(true)}>
              Отклонить
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" variant="danger" disabled={pending} onClick={() => send("decline")}>
              Отклонить приглашение
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setDeclining(false)}>
              Назад
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
