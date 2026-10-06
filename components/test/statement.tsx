import type { Block, Inline } from "@/server/testing/types";
import type { TrapTexts } from "@/server/testing/engine";

function InlineView({ x }: { x: Inline }) {
  if (typeof x === "string") return <>{x}</>;
  if ("code" in x) return <code className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[0.9em] text-accent">{x.code}</code>;
  if ("b" in x) return <strong className="font-semibold">{x.b}</strong>;
  // Trap #4 (value twin): the screen shows `shown` via CSS, while the DOM text
  // (what gets copied, read by extensions or scraped) contains `dom`.
  return (
    <span className="twin" data-shown={x.twin.shown} role="img" aria-label={x.twin.shown}>
      <span className="twin-dom">{x.twin.dom}</span>
    </span>
  );
}

export function Statement({ blocks, traps }: { blocks: Block[]; traps: TrapTexts }) {
  return (
    <div className="statement relative flex flex-col gap-3 text-[15px] leading-relaxed">
      {/* Trap #3: micro text inside the decorative line, almost background coloured. */}
      <svg aria-hidden="true" viewBox="0 0 600 14" className="h-3.5 w-full" preserveAspectRatio="none">
        <path d="M2 7 H590" className="stroke-accent" strokeOpacity="0.35" strokeWidth="1" />
        <circle cx="4" cy="7" r="3" className="fill-accent" />
        <circle cx="596" cy="7" r="3" className="fill-accent" />
        <text x="40" y="12" fontSize="4.5" className="fill-subtle" fontFamily="monospace">
          {traps.micro}
        </text>
      </svg>
      {blocks.map((b, i) => {
        const trap =
          i === 0 ? (
            // Trap #2: zero-size text, hidden from screen readers, present in the DOM / clipboard.
            <span aria-hidden="true" className="trap-hidden">
              {" "}
              {traps.hidden}{" "}
            </span>
          ) : null;
        if (b.type === "p")
          return (
            <p key={i}>
              {b.parts.map((x, k) => (
                <InlineView key={k} x={x} />
              ))}
              {trap}
            </p>
          );
        if (b.type === "code")
          return (
            <pre key={i} className="overflow-x-auto rounded-xl bg-code p-3 font-mono text-[13px] text-code-fg">
              {b.text}
            </pre>
          );
        if (b.type === "list")
          return (
            <ul key={i} className="list-disc pl-5">
              {b.items.map((it, k) => (
                <li key={k}>
                  {it.map((x, m) => (
                    <InlineView key={m} x={x} />
                  ))}
                </li>
              ))}
            </ul>
          );
        return (
          <div key={i} className="overflow-x-auto">
            <table className="min-w-[240px] border-collapse font-mono text-sm">
              <thead>
                <tr>
                  {b.head.map((h) => (
                    <th key={h} className="border-b border-accent/30 px-3 py-1.5 text-left font-medium text-accent">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, k) => (
                  <tr key={k}>
                    {r.map((cell, m) => (
                      <td key={m} className="border-b border-line/50 px-3 py-1.5">
                        {typeof cell === "number" ? cell : <InlineView x={cell} />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
