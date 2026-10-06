"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Blank } from "@/components/ui/blank";
import { Button } from "@/components/ui/button";
import { Field, Notice } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";

type Check = { code: string; title: string; risk?: boolean; passed?: boolean };
const DISCIPLINES = ["алгоритмическое", "продуктовое", "ИБ", "робототехника", "БАС"];

function Common({ v, set, prefix }: { v: Record<string, string>; set: (k: string, x: string) => void; prefix: string }) {
  return (
    <>
      <div className="sm:col-span-2">
        <Field label="Соревнование" htmlFor={`${prefix}-comp`}>
          <input id={`${prefix}-comp`} className="input" value={v.competition} onChange={(e) => set("competition", e.target.value)} />
        </Field>
      </div>
      <Field label="Дисциплина" htmlFor={`${prefix}-disc`}>
        <select id={`${prefix}-disc`} className="input" value={v.discipline} onChange={(e) => set("discipline", e.target.value)}>
          {DISCIPLINES.map((d) => <option key={d}>{d}</option>)}
        </select>
      </Field>
      <Field label="Этап" htmlFor={`${prefix}-stage`}>
        <select id={`${prefix}-stage`} className="input" value={v.stage} onChange={(e) => set("stage", e.target.value)}>
          <option value="regional">Региональный</option>
          <option value="district">Окружной</option>
          <option value="final">Финал</option>
        </select>
      </Field>
      <Field label="Год" htmlFor={`${prefix}-year`}>
        <input id={`${prefix}-year`} className="input font-mono" inputMode="numeric" value={v.year} onChange={(e) => set("year", e.target.value)} />
      </Field>
      <Field label="Место (если было)" htmlFor={`${prefix}-place`}>
        <input id={`${prefix}-place`} className="input font-mono" inputMode="numeric" value={v.place} onChange={(e) => set("place", e.target.value)} />
      </Field>
    </>
  );
}

function Checks({ items }: { items: Check[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-1 text-sm">
      {items.map((c) => {
        const bad = c.risk === true || c.passed === false;
        return (
          <li key={c.code} className={bad ? "text-danger" : "text-ok"}>
            {bad ? "⚠" : "✓"} {c.title}
          </li>
        );
      })}
    </ul>
  );
}

export function EvidenceForms() {
  const router = useRouter();
  const year = String(new Date().getFullYear());
  const [cert, setCert] = useState<Record<string, string>>({ competition: "", discipline: "продуктовое", stage: "regional", year, place: "", eventDate: "" });
  const [repo, setRepo] = useState<Record<string, string>>({ competition: "", discipline: "продуктовое", stage: "regional", year, place: "", repo: "", login: "", from: "", to: "" });
  const [file, setFile] = useState<File | null>(null);
  const [certRes, setCertRes] = useState<{ trust: string; checks: Check[]; achievementSource: string } | null>(null);
  const [repoRes, setRepoRes] = useState<{ ok: boolean; checks: Check[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCert(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setErr("Выберите файл");
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      for (const [k, v] of Object.entries(cert)) if (v) fd.set(k, v);
      const res = await fetch("/api/v1/me/certificates", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.error?.code, data.error?.message);
      setCertRes(data);
      router.refresh();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function sendRepo(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      setRepoRes(await api("/api/v1/me/repo-check", { body: { ...repo, year: Number(repo.year), place: repo.place ? Number(repo.place) : null } }));
      router.refresh();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {err && <Notice tone="error">{err}</Notice>}
      <Blank label="Подтвердить сертификатом организатора">
        <form onSubmit={sendCert} className="grid gap-3 sm:grid-cols-2">
          <Common v={cert} set={(k, x) => setCert({ ...cert, [k]: x })} prefix="cert" />
          <Field label="Дата мероприятия" htmlFor="cert-date">
            <input id="cert-date" type="date" className="input" value={cert.eventDate} onChange={(e) => setCert({ ...cert, eventDate: e.target.value })} />
          </Field>
          <Field label="Файл (PDF, JPG, PNG до 4 МБ)" htmlFor="cert-file">
            <input id="cert-file" type="file" accept="application/pdf,image/png,image/jpeg" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          <p className="text-xs text-muted sm:col-span-2">Проверяем метаданные: в каком приложении собран файл, правился ли он после выдачи, не создан ли раньше мероприятия, есть ли подпись. Это сигналы, а не вердикт.</p>
          <Button type="submit" variant="secondary" disabled={busy}>
            Проверить и добавить
          </Button>
        </form>
        {certRes && (
          <div className="mt-3">
            <Notice tone={certRes.trust === "low" ? "error" : "ok"}>
              {certRes.trust === "low" ? "Есть сигналы риска — достижение добавлено как заявленное (минимальный вес)." : "Сигналов риска нет — достижение подтверждено организатором."}
            </Notice>
            <Checks items={certRes.checks} />
          </div>
        )}
      </Blank>

      <Blank label="Подтвердить репозиторием (хакатоны)">
        <form onSubmit={sendRepo} className="grid gap-3 sm:grid-cols-2">
          <Common v={repo} set={(k, x) => setRepo({ ...repo, [k]: x })} prefix="repo" />
          <Field label="Репозиторий" htmlFor="repo-name" hint="owner/repo">
            <input id="repo-name" className="input font-mono" value={repo.repo} onChange={(e) => setRepo({ ...repo, repo: e.target.value })} />
          </Field>
          <Field label="Ваш логин GitHub" htmlFor="repo-login">
            <input id="repo-login" className="input font-mono" value={repo.login} onChange={(e) => setRepo({ ...repo, login: e.target.value })} />
          </Field>
          <Field label="Начало мероприятия" htmlFor="repo-from">
            <input id="repo-from" type="date" className="input" value={repo.from} onChange={(e) => setRepo({ ...repo, from: e.target.value })} />
          </Field>
          <Field label="Окончание" htmlFor="repo-to">
            <input id="repo-to" type="date" className="input" value={repo.to} onChange={(e) => setRepo({ ...repo, to: e.target.value })} />
          </Field>
          <Button type="submit" variant="secondary" disabled={busy}>
            Проверить репозиторий
          </Button>
        </form>
        {repoRes && (
          <div className="mt-3">
            <Notice tone={repoRes.ok ? "ok" : "error"}>{repoRes.ok ? "Проверки пройдены — достижение подтверждено репозиторием." : "Проверки не пройдены — достижение не добавлено."}</Notice>
            <Checks items={repoRes.checks} />
          </div>
        )}
      </Blank>
    </>
  );
}
