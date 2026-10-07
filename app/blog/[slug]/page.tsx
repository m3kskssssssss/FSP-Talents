import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/blog/article-card";
import { Badge } from "@/components/ui/badge";
import { PageTitle } from "@/components/ui/blank";
import { ButtonLink } from "@/components/ui/button";
import { Pattern } from "@/components/ui/pattern";
import { articles, getArticle } from "@/lib/blog";
import { date } from "@/lib/format";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const a = getArticle((await params).slug);
  return a ? { title: a.title, description: a.excerpt } : {};
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = getArticle((await params).slug);
  if (!a) notFound();
  const more = articles.filter((x) => x.slug !== a.slug).slice(0, 3);
  return (
    <div className="flex flex-col gap-16">
      <article className="mx-auto w-full max-w-3xl">
        <PageTitle
          title={a.title}
          back={{ href: "/blog", label: "Все статьи" }}
          meta={
            <>
              <time dateTime={a.date}>{date(a.date)}</time> · {a.minutes} мин чтения
            </>
          }
        />
        <div className="rise border-accent/30 bg-subtle text-accent mb-10 overflow-hidden rounded-[var(--radius-blank)] border">
          <Pattern seed={a.slug} animated density={1.4} className="aspect-[2/1] w-full" />
        </div>
        <Badge className="mb-6">{a.tag}</Badge>
        <div className="flex max-w-prose flex-col gap-5 text-[17px] leading-relaxed text-pretty">
          {a.body.map((b, i) =>
            "h" in b ? (
              <h2 key={i} className="h-display mt-4 text-2xl">
                {b.h}
              </h2>
            ) : "p" in b ? (
              <p key={i}>{b.p}</p>
            ) : "quote" in b ? (
              <blockquote
                key={i}
                className="border-accent text-accent relative my-2 border-l-2 py-1 pl-5 text-xl"
              >
                <span
                  aria-hidden="true"
                  className="bg-accent absolute top-0 -left-[5px] size-2 rounded-full"
                />
                {b.quote}
              </blockquote>
            ) : (
              <ul key={i} className="flex flex-col gap-2.5">
                {b.list.map((li) => (
                  <li key={li} className="relative pl-6">
                    <span
                      aria-hidden="true"
                      className="border-accent absolute top-[0.6em] left-0 size-2 rounded-full border-2"
                    />
                    {li}
                  </li>
                ))}
              </ul>
            ),
          )}
        </div>
        <div className="blank mt-12 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg font-medium text-balance">
            Проверьте свой уровень и получите категорию
          </p>
          <ButtonLink href="/register?role=candidate">Пройти тест</ButtonLink>
        </div>
      </article>
      <section aria-labelledby="more">
        <h2 id="more" className="h-display mb-6 text-2xl sm:text-3xl">
          Читайте также
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {more.map((m) => (
            <ArticleCard key={m.slug} a={m} />
          ))}
        </div>
      </section>
    </div>
  );
}
