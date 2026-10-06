"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";

export function ApplyButton({ id, applied }: { id: string; applied: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  if (applied) return <p className="text-sm text-ok">Вы откликнулись — компания видит ваши контакты.</p>;
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        className="self-start"
        onClick={async () => {
          if (!confirm("Отклик откроет компании ваши контакты. Продолжить?")) return;
          try {
            await api(`/api/v1/vacancies/${id}/apply`, { body: {} });
            router.refresh();
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : "Ошибка");
          }
        }}
      >
        Откликнуться
      </Button>
      {err && <Notice tone="error">{err}</Notice>}
    </div>
  );
}
