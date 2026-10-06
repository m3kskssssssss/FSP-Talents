"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function RunSearch({ needId }: { needId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const r = await api<{ searchId: string }>(`/api/v1/needs/${needId}/search`, { method: "POST" });
        router.push(`/employer/searches/${r.searchId}`);
      }}
    >
      {pending ? "Подбираем…" : "Подобрать кандидатов"}
    </Button>
  );
}
