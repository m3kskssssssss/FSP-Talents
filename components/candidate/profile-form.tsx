"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { StackInput } from "@/components/employer/stack-input";
import { Button } from "@/components/ui/button";
import { Field, Notice } from "@/components/ui/field";
import { api, ApiError, fieldErrors } from "@/lib/api-client";

export interface ProfileValues {
  fullName: string;
  city: string;
  experienceYears: string;
  about: string;
  salaryExpectFrom: string;
  salaryExpectTo: string;
  inviteFloor: string;
  workFormat: string;
  email: string;
  phone: string;
  telegram: string;
  links: string;
  skills: string[];
}

const num = (s: string) => (s.trim() ? Number(s.replace(/\s/g, "").replace(",", ".")) : null);

/** Profile + contacts + declared skills, with optional PDF resume prefill. */
export function ProfileForm({
  initial,
  submitLabel,
  onSaved,
}: {
  initial: ProfileValues;
  submitLabel: string;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "info" | "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState<"upload" | "save" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<ProfileValues>) => setV((x) => ({ ...x, ...p }));

  async function upload(file: File) {
    setBusy("upload");
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/v1/me/resume", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok)
        throw new ApiError(res.status, data.error?.code, data.error?.message ?? "Ошибка");
      const d = data.draft as {
        fullName: string | null;
        city: string | null;
        experienceYears: number | null;
        about: string | null;
        skills: string[];
        contacts: { email?: string; phone?: string; telegram?: string; links?: string[] };
      };
      setV((x) => ({
        ...x,
        fullName: d.fullName ?? x.fullName,
        city: d.city ?? x.city,
        experienceYears: d.experienceYears !== null ? String(d.experienceYears) : x.experienceYears,
        about: d.about ?? x.about,
        email: d.contacts.email ?? x.email,
        phone: d.contacts.phone ?? x.phone,
        telegram: d.contacts.telegram ?? x.telegram,
        links: d.contacts.links?.length ? d.contacts.links.join("\n") : x.links,
        skills: [...new Set([...x.skills, ...d.skills])],
      }));
      setMsg({
        tone: "ok",
        text: `Резюме разобрано ${data.parsedBy === "llm" ? "ИИ" : "по правилам (ИИ недоступен)"}. Проверьте поля и сохраните. Навыки из резюме помечаются как «заявлено».${data.photo ? " Фото из резюме установлено в профиль — его можно заменить или удалить." : ""}`,
      });
      // the photo is saved at once; refresh shows it in the profile header (the unsaved form state is kept)
      if (data.photo) router.refresh();
    } catch (e) {
      setMsg({
        tone: "error",
        text: e instanceof ApiError ? e.message : "Не удалось загрузить файл",
      });
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setErrors({});
    setMsg(null);
    try {
      await api("/api/v1/me/profile", {
        method: "PUT",
        body: {
          fullName: v.fullName,
          city: v.city || null,
          about: v.about || null,
          experienceYears: num(v.experienceYears),
          salaryExpectFrom: num(v.salaryExpectFrom),
          salaryExpectTo: num(v.salaryExpectTo),
          inviteFloor: num(v.inviteFloor),
          workFormat: v.workFormat || null,
        },
      });
      await api("/api/v1/me/contacts", {
        method: "PUT",
        body: {
          email: v.email || undefined,
          phone: v.phone || undefined,
          telegram: v.telegram || undefined,
          links: v.links.split(/\s+/).filter(Boolean),
        },
      });
      await api("/api/v1/me/skills", { method: "PUT", body: { skills: v.skills } });
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      setMsg({
        tone: "error",
        text: err instanceof ApiError ? err.message : "Не удалось сохранить",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5" noValidate>
      <div className="border-accent/50 flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Есть резюме в PDF?</p>
          <p className="text-muted text-sm">
            Загрузите — заполним поля автоматически, а фото из резюме поставим в профиль. До 4 МБ.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          id="resume-file"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <Button
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={busy === "upload"}
        >
          {busy === "upload" ? "Разбираем…" : "Загрузить PDF"}
        </Button>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Имя и фамилия" htmlFor="fullName" error={errors.fullName}>
          <input
            id="fullName"
            className="input"
            value={v.fullName}
            onChange={(e) => set({ fullName: e.target.value })}
            autoComplete="name"
          />
        </Field>
        <Field label="Город" htmlFor="city">
          <input
            id="city"
            className="input"
            value={v.city}
            onChange={(e) => set({ city: e.target.value })}
            autoComplete="address-level2"
          />
        </Field>
        <Field label="Опыт, лет" htmlFor="exp" error={errors.experienceYears}>
          <input
            id="exp"
            className="input font-mono"
            inputMode="decimal"
            value={v.experienceYears}
            onChange={(e) => set({ experienceYears: e.target.value })}
          />
        </Field>
        <Field label="Формат работы" htmlFor="wf">
          <select
            id="wf"
            className="input"
            value={v.workFormat}
            onChange={(e) => set({ workFormat: e.target.value })}
          >
            <option value="">Не важно</option>
            <option value="remote">Удалённо</option>
            <option value="hybrid">Гибрид</option>
            <option value="office">Офис</option>
          </select>
        </Field>
        <Field label="Ожидания от, ₽ до НДФЛ"htmlFor="sf" error={errors.salaryExpectFrom}>
          <input
            id="sf"
            className="input font-mono"
            inputMode="numeric"
            value={v.salaryExpectFrom}
            onChange={(e) => set({ salaryExpectFrom: e.target.value })}
          />
        </Field>
        <Field label="Ожидания до, ₽ до НДФЛ"htmlFor="st" error={errors.salaryExpectTo}>
          <input
            id="st"
            className="input font-mono"
            inputMode="numeric"
            value={v.salaryExpectTo}
            onChange={(e) => set({ salaryExpectTo: e.target.value })}
          />
        </Field>
        <Field
          label="Порог приглашений, ₽"
          htmlFor="floor"
          error={errors.inviteFloor}
          hint="Приглашения, где верх вилки ниже порога, до вас не дойдут. Работодатель видит порог заранее и не тратит ваше время. Пусто — без порога."
        >
          <input
            id="floor"
            className="input font-mono"
            inputMode="numeric"
            value={v.inviteFloor}
            onChange={(e) => set({ inviteFloor: e.target.value })}
          />
        </Field>
      </div>
      <Field label="О себе" htmlFor="about">
        <textarea
          id="about"
          className="input min-h-24"
          value={v.about}
          onChange={(e) => set({ about: e.target.value })}
        />
      </Field>
      <Field
        label="Навыки"
        htmlFor="skills"
        hint="Заявленные навыки. Подтверждённые тестом добавятся автоматически и весят больше."
      >
        <StackInput id="skills" value={v.skills} onChange={(skills) => set({ skills })} />
      </Field>
      <fieldset className="border-accent/20 grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">
          Контакты — скрыты от работодателей, пока вы не примете приглашение
        </legend>
        <Field label="Email для связи" htmlFor="email" error={errors.email}>
          <input
            id="email"
            className="input"
            type="email"
            value={v.email}
            onChange={(e) => set({ email: e.target.value })}
            autoComplete="email"
          />
        </Field>
        <Field label="Телефон" htmlFor="phone" error={errors.phone}>
          <input
            id="phone"
            className="input"
            type="tel"
            value={v.phone}
            onChange={(e) => set({ phone: e.target.value })}
            autoComplete="tel"
          />
        </Field>
        <Field label="Telegram" htmlFor="tg" error={errors.telegram}>
          <input
            id="tg"
            className="input"
            value={v.telegram}
            onChange={(e) => set({ telegram: e.target.value })}
            placeholder="@username"
          />
        </Field>
        <Field label="Ссылки (GitHub, портфолио)" htmlFor="links" error={errors["links.0"]}>
          <textarea
            id="links"
            className="input min-h-11"
            value={v.links}
            onChange={(e) => set({ links: e.target.value })}
            placeholder="https://github.com/…"
          />
        </Field>
      </fieldset>
      <Button type="submit" size="lg" disabled={busy === "save"}>
        {busy === "save" ? "Сохраняем…" : submitLabel}
      </Button>
    </form>
  );
}
