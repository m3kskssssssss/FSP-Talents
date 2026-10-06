"use client";

import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { bracketMatching, indentOnInput, indentUnit, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { useEffect, useRef } from "react";

const langExt = { python: () => python(), javascript: () => javascript(), sql: () => sql() };

const theme = EditorView.theme({
  "&": { fontSize: "13.5px", height: "100%", backgroundColor: "#fff" },
  ".cm-scroller": { fontFamily: "var(--font-jetbrains), monospace", lineHeight: "1.55" },
  ".cm-gutters": { backgroundColor: "#f7f6ff", color: "#8f85ff", border: "none" },
  ".cm-activeLine": { backgroundColor: "#f1efff80" },
  "&.cm-focused": { outline: "none" },
});

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
          syntaxHighlighting(defaultHighlightStyle),
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

  return <div ref={host} className="h-full min-h-[260px] overflow-hidden rounded-xl border border-violet/40" />;
}
