"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";
const order: Mode[] = ["system", "light", "dark"];
const labels: Record<Mode, string> = { system: "как в системе", light: "светлая", dark: "тёмная" };

/** Must match the inline script in app/layout.tsx, which applies the choice before first paint. */
export const THEME_STORAGE_KEY = "theme";

function apply(mode: Mode) {
  const root = document.documentElement;
  if (mode === "system") delete root.dataset.theme;
  else root.dataset.theme = mode;
  try {
    if (mode === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // storage blocked (private mode): the choice still holds for this page view
  }
}

/** Cycles system → light → dark. The icon shows the current mode. */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setMode(t === "light" || t === "dark" ? t : "system");
  }, []);

  const next = order[(order.indexOf(mode) + 1) % order.length]!;
  return (
    <button
      type="button"
      onClick={() => {
        apply(next);
        setMode(next);
      }}
      className="rounded-full p-2 text-accent transition-colors hover:bg-accent-soft"
      aria-label={`Тема: ${labels[mode]}. Переключить на: ${labels[next]}`}
      title={`Тема: ${labels[mode]}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {mode === "light" && (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
          </>
        )}
        {mode === "dark" && <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />}
        {mode === "system" && (
          <>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M12 4v12" />
            <path d="M12 4h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7Z" fill="currentColor" stroke="none" />
            <path d="M8 20h8" />
          </>
        )}
      </svg>
    </button>
  );
}
