"use client";

import { useEffect, useState } from "react";

const fmt = (d: string) =>
  new Date(d).toLocaleString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Interview time in the viewer's own time zone. The server renders in UTC on
 * Vercel, so the first paint is Moscow time and the browser swaps in local.
 */
export function LocalTime({ value, className }: { value: string | Date; className?: string }) {
  const iso = typeof value === "string" ? value : value.toISOString();
  const [text, setText] = useState(
    () =>
      `${new Date(iso).toLocaleString("ru-RU", {
        timeZone: "Europe/Moscow",
        weekday: "short",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })} МСК`,
  );
  useEffect(() => setText(fmt(iso)), [iso]);
  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}
