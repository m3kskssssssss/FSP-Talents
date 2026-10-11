import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import { candidateProfileId, employerId } from "@/server/http/guard";
import { unreadChats } from "@/server/services/chats";
import { buttonClass } from "../ui/button";
import { Logo } from "../ui/logo";
import { HeaderPanels } from "./header-panels";
import { NavLinks, NavMenu } from "./nav";
import { SignOutButton } from "./sign-out";
import { ThemeToggle } from "./theme-toggle";

const navByRole = {
  candidate: [
    { href: "/candidate", label: "Кабинет" },
    { href: "/candidate/test", label: "Тесты" },
    { href: "/candidate/challenges", label: "Задачи" },
    { href: "/candidate/invitations", label: "Приглашения" },
    { href: "/candidate/vacancies", label: "Вакансии" },
    { href: "/candidate/fsp", label: "ФСП" },
    { href: "/candidate/profile", label: "Профиль" },
    { href: "/candidate/chats", label: "Чаты" },
    { href: "/blog", label: "Блог" },
  ],
  employer: [
    { href: "/employer", label: "Кабинет" },
    { href: "/employer/needs", label: "Потребности" },
    { href: "/employer/search", label: "Поиск по базе" },
    { href: "/employer/shortlist", label: "Избранное" },
    { href: "/employer/invitations", label: "Приглашения" },
    { href: "/employer/vacancies", label: "Вакансии" },
    { href: "/employer/challenges", label: "Задачи" },
    { href: "/employer/chats", label: "Чаты" },
    { href: "/blog", label: "Блог" },
  ],
  admin: [
    { href: "/admin", label: "Модерация" },
    { href: "/admin/templates", label: "Банк заданий" },
    { href: "/admin/plagiarism", label: "Похожие решения" },
    { href: "/admin/reports", label: "Жалобы" },
    { href: "/blog", label: "Блог" },
  ],
} as const;

export async function Header() {
  const session = await auth();
  const role = session?.user?.role;
  const nav = role ? navByRole[role] : [];
  const uid = session?.user?.id;
  const unread = { notifications: 0, chats: 0 };
  if (uid && role) {
    unread.notifications =
      (
        await db()
          .select({ n: count() })
          .from(notifications)
          .where(and(eq(notifications.userId, uid), isNull(notifications.readAt)))
      )[0]?.n ?? 0;
    if (role === "candidate")
      unread.chats = await unreadChats({ role, profileId: await candidateProfileId(uid) }).catch(
        () => 0,
      );
    if (role === "employer")
      unread.chats = await unreadChats({ role, employerId: await employerId(uid) }).catch(() => 0);
  }
  return (
    <header className="border-accent/15 bg-canvas sticky top-0 z-40 border-b">
      <div className="relative mx-auto flex max-w-6xl items-center gap-x-6 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3"
          aria-label="ФСП Таланты — на главную"
        >
          <Logo width={84} priority className="flex" />
          <span className="text-accent hidden font-mono text-xs tracking-[0.14em] uppercase sm:inline">
            Таланты
          </span>
        </Link>
        {nav.length > 0 && <NavLinks items={nav} />}
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          {session?.user ? (
            <>
              {role && <HeaderPanels role={role} unread={unread} />}
              {nav.length > 0 ? (
                <>
                  <NavMenu items={nav} footer={<SignOutButton />} />
                  <div className="hidden xl:block">
                    <SignOutButton />
                  </div>
                </>
              ) : (
                <SignOutButton />
              )}
            </>
          ) : (
            <>
              <span className="hidden min-[440px]:block">
                <Link href="/blog" className={buttonClass("ghost", "sm")}>
                  Блог
                </Link>
              </span>
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
