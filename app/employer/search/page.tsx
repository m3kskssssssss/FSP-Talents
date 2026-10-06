import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/blank";
import { requireEmployer } from "@/server/http/guard";
import { BaseSearchForm } from "./base-search-form";

export const metadata: Metadata = { title: "Поиск по базе" };

export default async function BaseSearchPage() {
  await requireEmployer();
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle kicker="Поиск по базе" title="Найти кандидатов без потребности">
        Только кандидаты с категорией по результатам теста. Вилка здесь необязательна — она нужна при отправке приглашения.
      </PageTitle>
      <BaseSearchForm />
    </div>
  );
}
