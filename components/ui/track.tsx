/**
 * Decorative "дорожка" from the FSP booklet: a thin line with dots and rounded
 * turns. Purely decorative, hidden from assistive tech.
 */
export function Track({ className, variant = "a" }: { className?: string; variant?: "a" | "b" }) {
  const d =
    variant === "a"
      ? "M8 8 H180 a24 24 0 0 1 24 24 V120 a24 24 0 0 0 24 24 H392"
      : "M8 140 V60 a32 32 0 0 1 32 -32 H260 a20 20 0 0 0 20 -20";
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 400 152" fill="none">
      <path d={d} stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy={variant === "a" ? 8 : 140} r="3.5" fill="currentColor" />
      <circle cx={variant === "a" ? 392 : 280} cy={variant === "a" ? 144 : 8} r="3.5" fill="currentColor" />
    </svg>
  );
}
