"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

/**
 * Modal dialog: a sheet over the whole screen on phones, a centred panel from
 * `sm`. Escape and the backdrop close it, focus moves in on open and returns
 * to the opener on close, the page behind does not scroll.
 */
export function Modal({
  open,
  onClose,
  title,
  aside,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  aside?: ReactNode;
  size?: "md" | "lg";
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // the portal needs document.body, which exists only after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      // keep Tab inside the dialog
      const items = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-start sm:p-6 sm:pt-[8vh]">
      <div
        aria-hidden="true"
        className="modal-backdrop bg-fg/40 absolute inset-0"
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "modal-panel bg-surface shadow-pop sm:border-accent/45 relative flex w-full flex-col overflow-hidden outline-none sm:max-h-[84vh] sm:rounded-[var(--radius-blank)] sm:border",
          size === "lg" ? "sm:max-w-4xl" : "sm:max-w-lg",
        )}
      >
        <div className="border-accent/15 flex items-center gap-3 border-b px-4 py-3 sm:px-5">
          <h2 id={titleId} className="h-display text-lg">
            {title}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            {aside}
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="text-accent hover:bg-accent-soft rounded-full p-2 transition-colors"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
