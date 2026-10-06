"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

export function StatusSwitch({ id, status, reason }: { id: string; status: string; reason: string | null }) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label="Статус шаблона"
        className="rounded-lg border border-gray px-2 py-1 text-xs"
        value={status}
        onChange={async (e) => {
          await api(`/api/v1/admin/templates/${id}`, { method: "PATCH", body: { status: e.target.value } });
          router.refresh();
        }}
      >
        <option value="active">active</option>
        <option value="flagged">flagged</option>
        <option value="retired">retired</option>
      </select>
      {status === "flagged" && reason && <span className="max-w-48 text-[11px] text-red-700">{reason}</span>}
    </div>
  );
}
