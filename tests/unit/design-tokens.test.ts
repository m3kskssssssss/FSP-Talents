import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { CANVAS } from "@/lib/theme";

/**
 * Guards the design system (DESIGN.md) so new features cannot quietly break
 * the dark theme or drift off-brand:
 *
 * - colours come only from the semantic tokens in app/globals.css;
 * - every themed token has a light and a dark value (light-dark());
 * - the `dark:` variant stays inside components/ui (pages use tokens instead).
 *
 * A file that genuinely needs literal colours (e.g. a syntax palette) opts out
 * with the comment `design-tokens: allow-raw-colors` and a reason.
 */

const root = join(import.meta.dirname, "..", "..");
const globalsCss = join(root, "app", "globals.css");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(tsx?|css)$/.test(e.name) ? [p] : [];
  });
}

const files = [...walk(join(root, "app")), ...walk(join(root, "components"))].filter((f) => f !== globalsCss);
const rel = (f: string) => relative(root, f).split(sep).join("/");
const optedOut = (src: string) => src.includes("design-tokens: allow-raw-colors");

function offences(pattern: RegExp, filter: (f: string, src: string) => boolean = (_, src) => !optedOut(src)) {
  const found: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (!filter(f, src)) continue;
    src.split(/\r?\n/).forEach((line, i) => {
      for (const m of line.matchAll(pattern)) found.push(`${rel(f)}:${i + 1}  ${m[0].trim()}`);
    });
  }
  return found;
}

// Old brand names that are now tokens, plus Tailwind's default palette (disabled in globals.css).
const palette =
  "white|black|graphite|light|gray|violet|violet-light|(?:violet|red|slate|zinc|neutral|stone|gray|amber|green|emerald|blue|yellow|sky|indigo|purple|rose|pink|orange|lime|teal|cyan|fuchsia)-\\d{2,3}";
const colourUtility = new RegExp(
  `(?<=^|[\\s"'\`:])(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|outline|fill|stroke|decoration|divide|placeholder|accent|caret|from|via|to|shadow)-(?:${palette})(?![\\w-])`,
  "g",
);

describe("design tokens", () => {
  it("UI code uses semantic colour tokens, not raw palette utilities", () => {
    expect(offences(colourUtility), "use bg-surface / text-fg / text-muted / border-line / bg-primary / text-accent … (see DESIGN.md)").toEqual([]);
  });

  it("UI code has no literal colours (hex, rgb, hsl, oklch)", () => {
    const literal = /#[0-9a-fA-F]{3,8}\b(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab)\(/g;
    expect(offences(literal), "add a token to app/globals.css instead of a literal colour").toEqual([]);
  });

  it("the dark: variant is used only inside components/ui", () => {
    const dark = /(?<=^|[\s"'`])dark:[\w-[\]/.]+/g;
    expect(offences(dark, (f) => !rel(f).startsWith("components/ui/"))).toEqual([]);
  });

  it("every themed colour token defines a light and a dark value", () => {
    const css = readFileSync(globalsCss, "utf8");
    const theme = css.slice(css.indexOf("@theme {"), css.indexOf("}", css.indexOf("@theme {")));
    // Constant on purpose: brand fills that read correctly on both canvases.
    const constant = new Set(["primary", "on-primary", "red", "code-fg"]);
    const tokens = [...theme.matchAll(/--color-([a-z-]+):\s*([^;]+);/g)].filter(([, name]) => name !== "*");
    expect(tokens.length).toBeGreaterThan(10);
    const notThemed = tokens.filter(([, name, value]) => !constant.has(name!) && !value!.startsWith("light-dark(")).map(([, name]) => name);
    expect(notThemed).toEqual([]);
  });

  it("theme-color in lib/theme.ts matches the canvas token", () => {
    const css = readFileSync(globalsCss, "utf8");
    const m = /--color-canvas:\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/i.exec(css);
    expect(m && { light: m[1]!.toLowerCase(), dark: m[2]!.toLowerCase() }).toEqual(CANVAS);
  });
});
