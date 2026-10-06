"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Blank } from "@/components/ui/blank";
import { Button } from "@/components/ui/button";
import { Field, Notice } from "@/components/ui/field";
import { api } from "@/lib/api-client";

export function Review({ id, reviewed, passed }: { id: string; reviewed: boolean; passed: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  async function send(decision: "approve" | "reject") {
    const r = await api<{ categoryAssigned: boolean }>(`/api/v1/admin/attempts/${id}/review`, { body: { decision, note: note || undefined } });
    setDone(decision === "approve" ? (r.categoryAssigned ? "Подтверждено, категория присвоена (с пометкой)." : "Подтверждено.") : "Отклонено: категория по этой попытке снята.");
    router.refresh();
  }
  return (
    <Blank label={reviewed ? "Повторное решение" : "Решение модератора"}>
      <Field label="Комментарий (виден в журнале)" htmlFor="note">
        <textarea id="note" className="input min-h-16" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => send("approve")}>{passed ? "Подтвердить и присвоить категорию" : "Подтвердить"}</Button>
        <Button variant="danger" onClick={() => send("reject")}>
          Отклонить результат
        </Button>
      </div>
      {done && <div className="mt-3"><Notice tone="ok">{done}</Notice></div>}
    </Blank>
  );
}
