import Image from "next/image";
import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import { buttonClass } from "../ui/button";
import { SignOutButton } from "./sign-out";

const navByRole = {
  candidate: [
    { href: "/candidate", label: "Кабинет" },
    { href: "/candidate/test", label: "Тесты" },
    { href: "/candidate/invitations", label: "Приглашения" },
    { href: "/candidate/vacancies", label: "Вакансии" },
    { href: "/candidate/fsp", label: "ФСП" },
    { href: "/candidate/profile", label: "Профиль" },
  ],
  employer: [
    { href: "/employer", label: "Кабинет" },
    { href: "/employer/needs", label: "Потребности" },
    { href: "/employer/search", label: "Поиск по базе" },
    { href: "/employer/shortlist", label: "Избранное" },
    { href: "/employer/invitations", label: "Приглашения" },
    { href: "/employer/vacancies", label: "Вакансии" },
  ],
  admin: [
    { href: "/admin", label: "Модерация" },
    { href: "/admin/templates", label: "Банк заданий" },
    { href: "/admin/plagiarism", label: "Похожие решения" },
    { href: "/admin/reports", label: "Жалобы" },
  ],
} as const;

export async function Header() {
  const session = await auth();
  const role = session?.user?.role;
  const nav = role ? navByRole[role] : [];
  const unread = session?.user?.id
    ? ((await db().select({ n: count() }).from(notifications).where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt))))[0]?.n ?? 0)
    : 0;
  return (
    <header className="border-b border-violet/15 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="ФСП Таланты — на главную">
          <Image src="/brand/logo_02w.svg" alt="" width={84} height={28} priority />
          <span className="font-mono text-xs tracking-[0.14em] text-violet uppercase">Таланты</span>
        </Link>
        {nav.length > 0 && (
          <nav aria-label="Основная навигация" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-full px-3 py-1.5 text-sm whitespace-nowrap text-graphite hover:bg-violet-50 hover:text-violet">
                {n.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          {session?.user ? (
            <>
              <Link href="/notifications" className="relative rounded-full p-2 text-violet hover:bg-violet-50" aria-label={`Уведомления${unread ? `: ${unread} новых` : ""}`}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
                  <path d="M10 19a2 2 0 0 0 4 0" />
                </svg>
                {unread > 0 && <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red font-mono text-[10px] text-white">{unread > 9 ? "9+" : unread}</span>}
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className={buttonClass("ghost", "sm")}>
                Войти
              </Link>
              <Link href="/register" className={buttonClass("primary", "sm")}>
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
