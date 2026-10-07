"use client";

import { useEffect, useRef, useState } from "react";

const fmt = new Intl.NumberFormat("ru-RU");

/**
 * A number that counts up from zero when it scrolls into view. The server
 * renders the final value, so it reads correctly without JS and with reduced motion.
 */
export function CountUp({
  value,
  className,
  duration = 1200,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || value === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShown(0);
    let frame = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (t: number) => {
          const k = Math.min(1, (t - start) / duration);
          setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
          if (k < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {fmt.format(shown)}
    </span>
  );
}
