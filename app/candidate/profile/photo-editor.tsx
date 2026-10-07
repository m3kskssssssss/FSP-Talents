"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar } from "@/components/candidate/profile-hero";
import { ApiError, api } from "@/lib/api-client";

/** The avatar with upload / remove controls. Saves immediately; errors show under the buttons. */
export function PhotoEditor({ name, photo }: { name: string; photo: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy("upload");
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/v1/me/photo", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new ApiError(res.status, data.error?.code, data.error?.message ?? "Ошибка");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Не удалось загрузить фото. Попробуйте ещё раз.",
      );
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy("remove");
    setError(null);
    try {
      await api("/api/v1/me/photo", { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось удалить фото");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex shrink-0 flex-row items-center gap-4 sm:flex-col sm:gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy !== null}
        aria-label={photo ? "Заменить фото" : "Загрузить фото"}
        className="group relative rounded-full disabled:opacity-60"
      >
        <Avatar name={name} photo={photo} />
        <span className="bg-fg/55 text-on-primary absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <div className="flex flex-col items-start gap-1 text-sm sm:items-center">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy !== null}
          className="text-accent hover:underline disabled:opacity-60"
        >
          {busy === "upload" ? "Загружаем…" : photo ? "Заменить фото" : "Загрузить фото"}
        </button>
        {photo && (
          <button
            type="button"
            onClick={remove}
            disabled={busy !== null}
            className="text-muted hover:text-danger disabled:opacity-60"
          >
            {busy === "remove" ? "Удаляем…" : "Удалить"}
          </button>
        )}
        {error && (
          <p role="alert" className="text-danger max-w-48 text-xs">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
