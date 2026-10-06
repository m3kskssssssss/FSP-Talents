"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Blank } from "@/components/ui/blank";
import { Button } from "@/components/ui/button";
import { Field, Notice } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";
import { dateTime } from "@/lib/format";

type Consent = { kind: string; version: string; acceptedAt: string };
const TITLES: Record<string, string> = { pd_processing: "Обработка персональных данных", privacy_policy: "Политика конфиденциальности", marketing: "Новости и рассылки ФСП" };

export function PrivacySettings({ visibility, consents, log }: { visibility: string; consents: Consent[]; log: { action: string; at: string; company: string }[] }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const has = (k: string) => consents.find((c) => c.kind === k);

  async function toggle(kind: string, granted: boolean) {
    if (kind === "pd_processing" && !granted && !window.confirm("Без согласия на обработку ПДн профиль исчезнет из подборок. Продолжить?")) return;
    await api("/api/v1/me/consents", { body: { kind, granted } });
    router.refresh();
  }

  async function del() {
    setError(null);
    try {
      await api("/api/v1/me", { method: "DELETE", body: { confirm } });
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Blank label="Видимость">
        <p className="mb-3 text-sm">{visibility === "visible" ? "Профиль виден работодателям в подборках (без контактов)." : "Профиль скрыт: вы не появляетесь в подборках и поиске."}</p>
        <Button variant={visibility === "visible" ? "secondary" : "primary"} onClick={async () => { await api("/api/v1/me/visibility", { method: "PUT", body: { visibility: visibility === "visible" ? "hidden" : "visible" } }); router.refresh(); }}>
          {visibility === "visible" ? "Скрыть профиль" : "Показывать профиль"}
        </Button>
      </Blank>

      <Blank label="Согласия">
        <ul className="flex flex-col gap-3">
          {(["pd_processing", "privacy_policy", "marketing"] as const).map((k) => {
            const c = has(k);
            return (
              <li key={k} className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{TITLES[k]}</p>
                  <p className="text-xs text-muted">{c ? `Дано ${dateTime(c.acceptedAt)}, версия ${c.version}` : "Не дано"}</p>
                </div>
                <Button size="sm" variant={c ? "ghost" : "secondary"} onClick={() => toggle(k, !c)}>
                  {c ? "Отозвать" : "Дать согласие"}
                </Button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Текст политики — <Link className="link" href="/privacy">на отдельной странице</Link>.
        </p>
      </Blank>

      <Blank label="Кто видел мои контакты">
        {!log.length && <p className="text-sm text-muted">Никто — контакты открываются только после того, как вы примете приглашение.</p>}
        <ul className="flex flex-col gap-1.5 text-sm">
          {log.map((l, i) => (
            <li key={i} className="flex flex-wrap gap-2">
              <span className="font-mono text-xs text-muted">{dateTime(l.at)}</span>
              <span>{l.company}</span>
              <span className="text-muted">— {l.action === "contacts.disclosed" ? "контакты открыты (вы приняли приглашение)" : "просмотр контактов"}</span>
            </li>
          ))}
        </ul>
      </Blank>

      <Blank label="Удаление аккаунта" className="border-red/50">
        <p className="mb-3 text-sm">Персональные данные и контакты будут удалены, открытые приглашения — закрыты. Обезличенная статистика тестов сохранится для калибровки заданий.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Field label="Для подтверждения введите УДАЛИТЬ" htmlFor="confirm">
              <input id="confirm" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          </div>
          <Button variant="danger" onClick={del} disabled={confirm !== "УДАЛИТЬ"}>
            Удалить аккаунт
          </Button>
        </div>
        {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
      </Blank>
    </div>
  );
}
