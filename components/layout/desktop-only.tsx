"use client";

import { useEffect, useState } from "react";
import { Notice } from "../ui/field";

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile|webOS|BlackBerry/i;

/**
 * True on a computer: a desktop user agent and a primary pointer that is not a
 * finger. A touch-only iPad posing as a Mac fails the pointer check; headless
 * browsers report no pointer at all and pass. `null` until mounted, so the
 * server render does not guess.
 */
export function useIsDesktop() {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const check = () => setDesktop(!mq.matches && !MOBILE_UA.test(navigator.userAgent));
    check();
    mq.addEventListener("change", check);
    return () => mq.removeEventListener("change", check);
  }, []);
  return desktop;
}

export function DesktopOnlyNotice({ children }: { children: React.ReactNode }) {
  return (
    <Notice tone="error">
      <span className="font-medium">Только с компьютера.</span> {children}
    </Notice>
  );
}
