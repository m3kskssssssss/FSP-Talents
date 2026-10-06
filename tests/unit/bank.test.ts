import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { BANK, templatesFor } from "@/server/testing/bank";
import {
  checkAnswer,
  hiddenPayload,
  instanceParams,
  referenceAnswer,
  renderItem,
  valuesEqual,
  type Answer,
} from "@/server/testing/engine";
import { runSql } from "@/server/testing/sqlite";
import type { CodeTemplate, Template } from "@/server/testing/types";

const SEEDS = ["s1", "s2", "s3", "seed-xyz", "42"];
const MARKER = "kvant_x9";

const hasPython = (() => {
  try {
    execFileSync("python3", ["--version"]);
    return true;
  } catch {
    return false;
  }
})();

function runPython(source: string, fn: string, inputs: unknown[][]): unknown[] {
  const script = `${source}\nimport json, sys\ndata = json.load(sys.stdin)\nprint(json.dumps([${fn}(*args) for args in data]))\n`;
  const out = execFileSync("python3", ["-c", script], { input: JSON.stringify(inputs) });
  return JSON.parse(out.toString()) as unknown[];
}

function runJs(source: string, fn: string, inputs: unknown[][]): unknown[] {
  const f = new Function(`${source}\nreturn ${fn};`)() as (...a: unknown[]) => unknown;
  return inputs.map((args) => JSON.parse(JSON.stringify(f(...(JSON.parse(JSON.stringify(args)) as unknown[])))));
}

describe("task bank", () => {
  it.each(["backend", "frontend", "data", "qa"] as const)("%s: >= 25 templates, quiz share below 0.3, difficulty spread", (spec) => {
    const ts = templatesFor(spec);
    expect(ts.length).toBeGreaterThanOrEqual(25);
    expect(ts.filter((t) => t.kind === "quiz").length / ts.length).toBeLessThan(0.3);
    const bs = ts.map((t) => t.b);
    expect(Math.min(...bs)).toBeLessThan(-1.5);
    expect(Math.max(...bs)).toBeGreaterThan(1.5);
  });

  it("has unique ids and every code template has references for all its languages", () => {
    expect(new Set(BANK.map((t) => t.id)).size).toBe(BANK.length);
    for (const t of BANK) if (t.kind === "code") for (const l of t.languages) expect(t.reference[l], `${t.id} ${l}`).toBeTypeOf("function");
  });

  describe.each(BANK.map((t) => [t.id, t] as [string, Template]))("%s", (_id, t) => {
    it("renders deterministically and varies across seeds", async () => {
      const a = await renderItem(t, "s1", MARKER);
      const b = await renderItem(t, "s1", MARKER);
      expect(a.hash).toBe(b.hash);
      const hashes = new Set<string>();
      for (const s of SEEDS) hashes.add((await renderItem(t, s, MARKER)).hash);
      expect(hashes.size).toBeGreaterThan(1);
      expect(JSON.stringify(a.view)).not.toMatch(/"correct"|"reference"/);
    });

    it("accepts the reference answer and rejects a wrong one", async () => {
      for (const s of SEEDS) {
        const ref = await referenceAnswer(t, s, "n1");
        const ok = await checkAnswer(t, s, MARKER, ref, "n1");
        expect(ok.correct, `${t.id} seed ${s}`).toBe(true);
        expect(ok.trapHits).toEqual([]);
        const wrong = wrongAnswer(ref);
        const bad = await checkAnswer(t, s, MARKER, wrong, "n1");
        expect(bad.correct).toBe(false);
      }
    });

    if (t.twin) {
      it("detects answers computed from the DOM-only twin value", async () => {
        let detected = 0;
        for (const s of SEEDS) {
          const { p, p2 } = instanceParams(t, s);
          const twinAnswer = await answerFor(t, p2, s, "n1");
          const plain = await answerFor(t, p, s, "n1");
          if (JSON.stringify(twinAnswer) === JSON.stringify(plain)) continue;
          const r = await checkAnswer(t, s, MARKER, twinAnswer, "n1");
          expect(r.correct).toBe(false);
          if (r.trapHits.includes("twin")) detected++;
        }
        expect(detected).toBeGreaterThan(0);
      });
    }

    if (t.kind === "code") {
      const ct = t as CodeTemplate;
      it("reference solutions (JS / Python) agree with the server solver", () => {
        for (const s of SEEDS) {
          const { p } = instanceParams(ct, s);
          const inputs = [...(hiddenPayload(ct, s, "n1").inputs ?? []), ...(hiddenPayload(ct, s, "n2").inputs ?? [])];
          const expected = inputs.map((args) => ct.solve(p, JSON.parse(JSON.stringify(args))));
          if (ct.reference.javascript) {
            const js = runJs(ct.reference.javascript(p), ct.fn.name, inputs);
            js.forEach((v, i) => expect(valuesEqual(v, expected[i], ct.compare), `js ${s} #${i}`).toBe(true));
          }
          if (hasPython && ct.reference.python) {
            const py = runPython(ct.reference.python(p), ct.fn.name, inputs);
            py.forEach((v, i) => expect(valuesEqual(v, expected[i], ct.compare), `py ${s} #${i}`).toBe(true));
          }
        }
      });

      it("detects the personal marker in submitted code", async () => {
        const ref = (await referenceAnswer(ct, "s1", "n1")) as Extract<Answer, { kind: "code" }>;
        const r = await checkAnswer(ct, "s1", MARKER, { ...ref, code: `${MARKER} = 1\n${ref.code}` }, "n1");
        expect(r.trapHits).toContain("marker");
      });

      it("hidden inputs depend on the nonce", () => {
        const a = JSON.stringify(hiddenPayload(ct, "s1", "n1"));
        const b = JSON.stringify(hiddenPayload(ct, "s1", "n2"));
        expect(a).not.toBe(b);
      });
    }

    if (t.kind === "quiz") {
      it("has at least one correct option and distinct options", async () => {
        for (const s of SEEDS) {
          const { view } = await renderItem(t, s, MARKER);
          const texts = view.quiz!.options.map((o) => o.text);
          expect(new Set(texts).size).toBe(texts.length);
          const ref = (await referenceAnswer(t, s, "n1")) as Extract<Answer, { kind: "quiz" }>;
          expect(ref.selected.length).toBeGreaterThan(0);
        }
      });
    }
  });
});

async function answerFor(t: Template, params: unknown, seed: string, nonce: string): Promise<Answer> {
  if (t.kind === "code") {
    const inputs = hiddenPayload(t, seed, nonce).inputs!;
    return { kind: "code", language: t.languages[0]!, code: "", outputs: inputs.map((a) => ({ ok: true, value: t.solve(params, JSON.parse(JSON.stringify(a))) })) };
  }
  if (t.kind === "sql") {
    const data = hiddenPayload(t, seed, nonce).data!;
    return { kind: "sql", code: "", result: await runSql(t.schema, data, t.reference(params)) };
  }
  if (t.kind === "calc") return { kind: "calc", value: String(t.answer(params)) };
  return { kind: "quiz", selected: [] };
}

function wrongAnswer(ref: Answer): Answer {
  switch (ref.kind) {
    case "code":
      return { ...ref, outputs: ref.outputs.map(() => ({ ok: true, value: "__wrong__" })) };
    case "sql":
      return { ...ref, result: { columns: ["x"], rows: [["__wrong__"]] } };
    case "calc":
      return { kind: "calc", value: String(Number(ref.value) + 1000) };
    case "quiz":
      return { kind: "quiz", selected: ["nope"] };
  }
}
