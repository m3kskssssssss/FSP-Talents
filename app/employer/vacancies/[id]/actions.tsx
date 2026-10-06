"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function ApplicationActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  if (status === "accepted" || status === "declined") return null;
  const set = async (s: string) => {
    await api(`/api/v1/applications/${id}`, { method: "PATCH", body: { status: s } });
    router.refresh();
  };
  return (
    <span className="ml-auto flex gap-2">
      <Button size="sm" onClick={() => set("accepted")}>Пригласить</Button>
      <Button size="sm" variant="ghost" onClick={() => set("declined")}>Отклонить</Button>
    </span>
  );
}
