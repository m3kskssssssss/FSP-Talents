"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "../ui/cn";

export type NavItem = { href: string; label: string };

/** A section root ("/candidate") is active only on itself; other items also on their sub-pages. */
function isActive(pathname: string, href: string, items: readonly NavItem[]) {
  if (pathname === href) return true;
  const isRoot = items.some((i) => i.href !== href && i.href.startsWith(href + "/"));
  return !isRoot && pathname.startsWith(href + "/");
}

const linkBase = "rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors";
const linkIdle = "text-fg hover:bg-accent-soft hover:text-accent";
const linkActive = "bg-accent-soft font-medium text-accent";

/** Inline links on wide screens. */
export function NavLinks({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Основная навигация" className="hidden items-center gap-1 lg:flex">
      {items.map((n) => {
        const active = isActive(pathname, n.href, items);
        return (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn(linkBase, active ? linkActive : linkIdle)}>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Disclosure menu below lg: the button sits in the header, the panel drops under it. */
export function NavMenu({ items, footer }: { items: readonly NavItem[]; footer?: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const current = items.find((n) => isActive(pathname, n.href, items));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-full border border-line px-3 text-sm text-fg transition-colors hover:border-accent/50"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
        <span className="max-w-[9rem] truncate">{current?.label ?? "Меню"}</span>
      </button>
      {open && (
        <nav id={panelId} aria-label="Основная навигация" className="absolute inset-x-0 top-full z-40 border-b border-accent/15 bg-canvas shadow-pop">
          <ul className="mx-auto grid max-w-6xl gap-1 px-4 py-3 sm:grid-cols-2 sm:px-6">
            {items.map((n) => {
              const active = isActive(pathname, n.href, items);
              return (
                <li key={n.href}>
                  <Link href={n.href} aria-current={active ? "page" : undefined} className={cn("block rounded-xl px-3 py-2.5 text-[15px]", active ? linkActive : linkIdle)}>
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          {footer && <div className="mx-auto flex max-w-6xl justify-end border-t border-accent/10 px-4 py-3 sm:px-6">{footer}</div>}
        </nav>
      )}
    </div>
  );
}
