import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui/blank";
import { buttonClass } from "@/components/ui/button";
import { AppError } from "@/server/lib/errors";
import { verifyEmail } from "@/server/services/accounts";

export const metadata: Metadata = { title: "Подтверждение email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let error: string | null = null;
  if (!token) error = "В ссылке нет токена";
  else {
    try {
      await verifyEmail(token);
    } catch (e) {
      error = e instanceof AppError ? e.message : "Не удалось подтвердить email";
    }
  }
  return (
    <div className="mx-auto max-w-md">
      <PageTitle kicker="Подтверждение email" title={error ? "Ссылка не сработала" : "Email подтверждён"}>
        {error ?? "Теперь можно войти в аккаунт."}
      </PageTitle>
      <Link href="/login" className={buttonClass("primary", "lg")}>
        Войти
      </Link>
    </div>
  );
}
