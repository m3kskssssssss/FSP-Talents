import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/blank";
import { DemoAccounts } from "@/components/layout/demo-accounts";
import { env } from "@/server/env";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Регистрация" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="Создайте аккаунт">
        Кандидаты проходят тест и получают категорию. Работодатели находят кандидатов и приглашают их.
      </PageTitle>
      {env().DEMO_MODE && <DemoAccounts className="mb-8" />}
      <RegisterForm initialRole={role === "employer" ? "employer" : "candidate"} />
    </div>
  );
}
