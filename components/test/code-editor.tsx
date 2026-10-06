"use client";

import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { useEffect, useRef } from "react";

const langExt = { python: () => python(), javascript: () => javascript(), sql: () => sql() };

// design-tokens: allow-raw-colors — the syntax palette below is tuned for the
// always-dark code surface and has no light/dark pair.
// The editor is a dark "terminal" in both site themes, like the code blocks
// (bg-code). Colours come from the design tokens; syntax colours are tuned for
// that dark background only.
const theme = EditorView.theme(
  {
    "&": { fontSize: "13.5px", height: "100%", backgroundColor: "var(--color-code)", color: "var(--color-code-fg)" },
    ".cm-scroller": { fontFamily: "var(--font-jetbrains), monospace", lineHeight: "1.55" },
    ".cm-content": { caretColor: "var(--color-code-fg)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-code-fg)" },
    ".cm-gutters": { backgroundColor: "var(--color-code)", color: "color-mix(in oklab, var(--color-code-fg) 40%, transparent)", border: "none" },
    ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in oklab, var(--color-code-fg) 6%, transparent)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "color-mix(in oklab, var(--color-primary) 45%, transparent)" },
    ".cm-matchingBracket": { backgroundColor: "color-mix(in oklab, var(--color-primary) 35%, transparent)", outline: "none" },
    "&.cm-focused": { outline: "none" },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.modifier], color: "#b4adff" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "#8fd9a8" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "#f0b86e" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "#7d808c", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#7cc7ff" },
  { tag: [t.typeName, t.className, t.namespace], color: "#ff9fb0" },
  { tag: [t.propertyName, t.attributeName], color: "#d6d8e0" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "#a3a5af" },
]);

export function CodeEditor({
  value,
  language,
  onChange,
  onPaste,
  label,
}: {
  value: string;
  language: "python" | "javascript" | "sql";
  onChange: (v: string) => void;
  onPaste?: (length: number) => void;
  label: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cb = useRef({ onChange, onPaste });
  cb.current = { onChange, onPaste };

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          indentOnInput(),
          bracketMatching(),
          highlightActiveLine(),
          indentUnit.of(language === "python" ? "    " : "  "),
          syntaxHighlighting(highlight),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          langExt[language](),
          theme,
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.domEventHandlers({
            paste(e) {
              cb.current.onPaste?.(e.clipboardData?.getData("text")?.length ?? 0);
              return false;
            },
          }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) cb.current.onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
    // Recreate only when language changes; value is synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={host} className="h-full min-h-[260px] overflow-hidden rounded-xl border border-accent/40" />;
}
