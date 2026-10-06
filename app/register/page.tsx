import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/blank";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Регистрация" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="Создайте аккаунт">
        Кандидаты проходят тест и получают категорию. Работодатели находят кандидатов и приглашают их.
      </PageTitle>
      <RegisterForm initialRole={role === "employer" ? "employer" : "candidate"} />
    </div>
  );
}
