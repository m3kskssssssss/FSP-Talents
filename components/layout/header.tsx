import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import { buttonClass } from "../ui/button";
import { Logo } from "../ui/logo";
import { NavLinks, NavMenu } from "./nav";
import { SignOutButton } from "./sign-out";
import { ThemeToggle } from "./theme-toggle";

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
    <header className="sticky top-0 z-40 border-b border-accent/15 bg-canvas">
      <div className="relative mx-auto flex max-w-6xl items-center gap-x-6 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="ФСП Таланты — на главную">
          <Logo width={84} priority className="flex" />
          <span className="hidden font-mono text-xs tracking-[0.14em] text-accent uppercase sm:inline">Таланты</span>
        </Link>
        {nav.length > 0 && <NavLinks items={nav} />}
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          {session?.user ? (
            <>
              <Link href="/notifications" className="relative rounded-full p-2 text-accent transition-colors hover:bg-accent-soft" aria-label={`Уведомления${unread ? `: ${unread} новых` : ""}`}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
                  <path d="M10 19a2 2 0 0 0 4 0" />
                </svg>
                {unread > 0 && <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red font-mono text-[10px] font-medium text-on-primary">{unread > 9 ? "9+" : unread}</span>}
              </Link>
              {nav.length > 0 ? (
                <>
                  <NavMenu items={nav} footer={<SignOutButton />} />
                  <div className="hidden lg:block">
                    <SignOutButton />
                  </div>
                </>
              ) : (
                <SignOutButton />
              )}
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
