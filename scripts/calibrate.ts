/**
 * IRT calibration of task templates (2PL a, b).
 *   npm run calibrate              # real answers where >= 30 per template, synthetic otherwise
 *   npm run calibrate -- --dry-run # print, do not write
 * In production the data source is real answers (attempt_items + attempt theta);
 * on a fresh prototype it falls back to N synthetic candidates with known theta.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });
import { and, eq, isNotNull } from "drizzle-orm";
import { GRADES } from "../server/config";
import { closeDb, db } from "../server/db";
import { attemptItems, taskTemplates, testAttempts } from "../server/db/schema";
import { simulateAttempt, type SynthSpec } from "../server/synth/population";
import { fitItem } from "../server/testing/calibration";
import type { BankItem } from "../server/testing/cat";
import { Rng } from "../server/testing/rng";
import { syncTemplates } from "../server/services/testing";

const MIN_REAL = 30;
const N_SYNTH = Number(process.env.CALIBRATE_N ?? 2000);
const dry = process.argv.includes("--dry-run");

async function main() {
  await syncTemplates(true);
  const templates = await db().select().from(taskTemplates);
  const real = await db()
    .select({ templateId: attemptItems.templateId, x: attemptItems.partialScore, theta: testAttempts.theta })
    .from(attemptItems)
    .innerJoin(testAttempts, eq(testAttempts.id, attemptItems.attemptId))
    .where(and(isNotNull(attemptItems.answeredAt), isNotNull(testAttempts.theta), isNotNull(attemptItems.partialScore)));
  const data = new Map<string, { theta: number; x: number }[]>();
  for (const r of real) data.set(r.templateId, [...(data.get(r.templateId) ?? []), { theta: r.theta!, x: r.x! >= 1 ? 1 : 0 }]);

  // Synthetic fallback per specialization for templates without enough real answers.
  const specs = [...new Set(templates.map((t) => t.specialization))] as SynthSpec[];
  const synth = new Map<string, { theta: number; x: number }[]>();
  for (const spec of specs) {
    const bank: BankItem[] = templates.filter((t) => t.specialization === spec && t.status === "active").map((t) => ({ id: t.id, kind: t.kind, a: t.discriminationA, b: t.difficultyB }));
    if (!bank.length) continue;
    const rng = new Rng(`calibrate/${spec}`);
    for (let i = 0; i < N_SYNTH; i++) {
      const theta = rng.normal() * 1.1 + 0.1;
      const a = simulateAttempt(theta, GRADES[i % 3]!, bank, rng.fork(`${i}`));
      for (const it of a.items) synth.set(it.templateId, [...(synth.get(it.templateId) ?? []), { theta: a.theta, x: it.x }]);
    }
  }

  console.log("template".padEnd(28), "src ", "n".padStart(5), " a_old  a_new   b_old  b_new");
  for (const t of templates) {
    const realData = data.get(t.id) ?? [];
    const src = realData.length >= MIN_REAL ? "real" : "synth";
    const d = src === "real" ? realData : (synth.get(t.id) ?? []);
    if (d.length < MIN_REAL) continue;
    const fit = fitItem(d, { a: t.discriminationA, b: t.difficultyB });
    console.log(t.id.padEnd(28), src.padEnd(5), String(d.length).padStart(5), t.discriminationA.toFixed(2).padStart(6), fit.a.toFixed(2).padStart(6), t.difficultyB.toFixed(2).padStart(7), fit.b.toFixed(2).padStart(6));
    if (!dry) {
      await db().update(taskTemplates).set({ discriminationA: fit.a, difficultyB: fit.b, calibratedAt: new Date() }).where(eq(taskTemplates.id, t.id));
    }
  }
  console.log(dry ? "dry run: nothing written" : "calibrated parameters written to task_templates");
  await closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
