import Image from "next/image";
import Link from "next/link";
import { auth } from "@/server/auth";
import { buttonClass } from "../ui/button";
import { SignOutButton } from "./sign-out";

const navByRole = {
  candidate: [
    { href: "/candidate", label: "Кабинет" },
    { href: "/candidate/test", label: "Тесты" },
    { href: "/candidate/invitations", label: "Приглашения" },
    { href: "/candidate/vacancies", label: "Вакансии" },
  ],
  employer: [
    { href: "/employer", label: "Кабинет" },
    { href: "/employer/needs", label: "Потребности" },
    { href: "/employer/search", label: "Поиск по базе" },
    { href: "/employer/shortlist", label: "Избранное" },
    { href: "/employer/invitations", label: "Приглашения" },
  ],
  admin: [
    { href: "/admin", label: "Модерация" },
    { href: "/admin/templates", label: "Банк заданий" },
  ],
} as const;

export async function Header() {
  const session = await auth();
  const role = session?.user?.role;
  const nav = role ? navByRole[role] : [];
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
            <SignOutButton />
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
