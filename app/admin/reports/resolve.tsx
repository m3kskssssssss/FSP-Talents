"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function Resolve({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const send = async (decision: "confirmed" | "dismissed") => {
    setPending(true);
    await api(`/api/v1/admin/reports/${id}`, { body: { decision } });
    router.refresh();
  };
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="danger" disabled={pending} onClick={() => send("confirmed")}>
        Подтвердить
      </Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => send("dismissed")}>
        Отклонить
      </Button>
    </div>
  );
}
