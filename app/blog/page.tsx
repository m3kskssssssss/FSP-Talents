import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ArticleCard } from "@/components/blog/article-card";
import { PageTitle } from "@/components/ui/blank";
import { articles } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Блог",
  description: "Статьи о тестировании, обратном подборе, зарплатах и достижениях ФСП.",
};

export default function BlogPage() {
  return (
    <div>
      <PageTitle title="Блог">
        Как устроены тест, подбор и витрина профиля — и как получить от платформы больше.
      </PageTitle>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a, i) => (
          <ArticleCard
            key={a.slug}
            a={a}
            className="rise"
            style={{ "--d": `${i * 70}ms` } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
