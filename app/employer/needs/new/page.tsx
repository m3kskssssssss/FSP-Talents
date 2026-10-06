import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/blank";
import { requireEmployer } from "@/server/http/guard";
import { NeedForm } from "./need-form";

export const metadata: Metadata = { title: "Новая потребность" };

export default async function NewNeedPage() {
  await requireEmployer();
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Кого ищете?">
        Заполните форму или вставьте текст вакансии — мы разберём его и покажем результат для проверки. Вилка зарплаты обязательна.
      </PageTitle>
      <NeedForm />
    </div>
  );
}
