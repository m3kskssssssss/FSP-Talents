"use client";

import { useState } from "react";
import { SKILLS, normalizeSkill, skillTitle } from "@/server/matching/skills";

/** Tag input for the tech stack with suggestions from the skill dictionary. */
export function StackInput({ value, onChange, id }: { value: string[]; onChange: (v: string[]) => void; id: string }) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const key = normalizeSkill(raw) ?? raw.trim().toLowerCase();
    if (key && !value.includes(key)) onChange([...value, key]);
    setText("");
  };
  const suggestions = text
    ? Object.entries(SKILLS)
        .filter(([k, s]) => !value.includes(k) && (s.title.toLowerCase().includes(text.toLowerCase()) || s.aliases.some((a) => a.startsWith(text.toLowerCase()))))
        .slice(0, 6)
    : [];
  return (
    <div>
      <div className="input flex min-h-11 flex-wrap items-center gap-1.5 py-1.5">
        {value.map((s) => (
          <span key={s} className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent">
            {skillTitle(s)}
            <button type="button" aria-label={`Убрать ${skillTitle(s)}`} onClick={() => onChange(value.filter((x) => x !== s))} className="text-accent/70 hover:text-danger">
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && text.trim()) {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
          }}
          placeholder={value.length ? "" : "Python, PostgreSQL…"}
          className="min-w-24 flex-1 bg-transparent text-[15px] outline-none"
          autoComplete="off"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {suggestions.map(([k, s]) => (
            <button key={k} type="button" onClick={() => add(k)} className="rounded-full border border-accent/30 px-2 py-0.5 text-xs text-accent hover:bg-accent-soft">
              + {s.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
