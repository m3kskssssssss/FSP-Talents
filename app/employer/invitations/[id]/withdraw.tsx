"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function WithdrawButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="danger"
      disabled={pending}
      onClick={async () => {
        if (!confirm("Отозвать приглашение?")) return;
        setPending(true);
        await api(`/api/v1/invitations/${id}/withdraw`, { method: "POST" });
        router.refresh();
        setPending(false);
      }}
    >
      Отозвать
    </Button>
  );
}
