"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Blank } from "@/components/ui/blank";
import { Button } from "@/components/ui/button";
import { Field, Notice } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";
import { EvidenceForms } from "./evidence";

type Ach = { id: string; competition: string; discipline: string; stage: "regional" | "district" | "final"; year: number; place: number | null; source: "fsp_registry" | "organizer" | "repo" | "self"; sportsCategory: string | null };
const STAGE = { regional: "региональный этап", district: "окружной этап", final: "финал" };
const SOURCE = { fsp_registry: ["реестр ФСП · высокое доверие", "ok"], organizer: ["организатор", "violet"], repo: ["репозиторий", "violet"], self: ["заявлено · минимальный вес", "gray"] } as const;

export function FspManager({ fspId, achievements }: { fspId: string | null; achievements: Ach[] }) {
  const router = useRouter();
  const [id, setId] = useState(fspId ?? "");
  const [msg, setMsg] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ competition: "", discipline: "алгоритмическое", stage: "regional", year: String(new Date().getFullYear()), place: "" });

  async function link() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ imported: number; sportsCategory: string | null }>("/api/v1/me/fsp", { body: { fspId: id } });
      setMsg({ tone: "ok", text: `Импортировано достижений: ${r.imported}${r.sportsCategory ? ` · разряд: ${r.sportsCategory}` : ""}` });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiError ? e.message : "Ошибка" });
    } finally {
      setBusy(false);
    }
  }

  async function addSelf(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/v1/me/achievements", { body: { competition: form.competition, discipline: form.discipline, stage: form.stage, year: Number(form.year), place: form.place ? Number(form.place) : null } });
      setForm({ ...form, competition: "", place: "" });
      router.refresh();
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof ApiError ? err.message : "Ошибка" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Blank label="ФСП ID">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Field label="Ваш ФСП ID" htmlFor="fspid" hint="Формат FSP-123456. В демо: окончание 000 — нет в реестре, 999 — реестр недоступен.">
              <input id="fspid" className="input font-mono uppercase" value={id} onChange={(e) => setId(e.target.value)} placeholder="FSP-123456" />
            </Field>
          </div>
          <Button onClick={link} disabled={busy || !id}>
            {busy ? "Запрашиваем реестр…" : fspId ? "Обновить из реестра" : "Привязать"}
          </Button>
        </div>
        {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      </Blank>

      <Blank label="Достижения">
        {!achievements.length && <p className="text-sm text-muted">Пока пусто. Отсутствие истории в ФСП не мешает подбору.</p>}
        <ul className="flex flex-col gap-2">
          {achievements.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono text-xs text-muted">{a.year}</span>
              <span>{a.competition}</span>
              <span className="text-muted">
                · {a.discipline}, {STAGE[a.stage]}
              </span>
              {a.place ? <Badge tone="red">{a.place} место</Badge> : <Badge tone="gray">участие</Badge>}
              <Badge tone={SOURCE[a.source][1]}>{SOURCE[a.source][0]}</Badge>
              {a.source === "self" && (
                <button type="button" className="ml-auto text-xs text-muted underline hover:text-red-700" onClick={async () => { await api(`/api/v1/me/achievements/${a.id}`, { method: "DELETE" }); router.refresh(); }}>
                  удалить
                </button>
              )}
            </li>
          ))}
        </ul>
      </Blank>

      <EvidenceForms />

      <Blank label="Добавить достижение вручную">
        <form onSubmit={addSelf} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Соревнование" htmlFor="comp">
              <input id="comp" className="input" value={form.competition} onChange={(e) => setForm({ ...form, competition: e.target.value })} required minLength={3} />
            </Field>
          </div>
          <Field label="Дисциплина" htmlFor="disc">
            <select id="disc" className="input" value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
              {["алгоритмическое", "продуктовое", "ИБ", "робототехника", "БАС"].map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Этап" htmlFor="stage">
            <select id="stage" className="input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
              <option value="regional">Региональный</option>
              <option value="district">Окружной</option>
              <option value="final">Финал</option>
            </select>
          </Field>
          <Field label="Год" htmlFor="year">
            <input id="year" className="input font-mono" inputMode="numeric" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          </Field>
          <Field label="Место (если было)" htmlFor="place">
            <input id="place" className="input font-mono" inputMode="numeric" value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} />
          </Field>
          <p className="text-xs text-muted sm:col-span-2">Заявленные достижения учитываются с минимальным весом. Подтвердить их можно сертификатом организатора или через реестр ФСП.</p>
          <Button type="submit" variant="secondary">
            Добавить
          </Button>
        </form>
      </Blank>
    </div>
  );
}
