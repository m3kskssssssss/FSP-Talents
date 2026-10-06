/**
 * Solution similarity between candidates: code is normalised (comments and
 * literals removed, identifiers anonymised), split into token 5-grams and
 * compared with Jaccard similarity. Suspicious clusters go to the moderator;
 * they are signals, not verdicts (short canonical solutions are naturally similar).
 */
const KEYWORDS = new Set(
  "def return if elif else for while in not and or is None True False lambda import from as class try except finally with yield pass break continue global function const let var new this null undefined true false typeof of switch case default throw catch select from where group by order having join left inner on as limit distinct count sum avg min max with over partition".split(" "),
);

export function normalizeCode(code: string): string[] {
  const noComments = code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/#.*$/gm, " ")
    .replace(/--.*$/gm, " ");
  const tokens = noComments.match(/[A-Za-z_][\w]*|\d+(?:\.\d+)?|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`[^`]*`|==|!=|<=|>=|=>|\*\*|[^\s\w]/g) ?? [];
  return tokens.map((t) => {
    if (/^\d/.test(t)) return "N";
    if (/^["'`]/.test(t)) return "S";
    if (/^[A-Za-z_]/.test(t)) return KEYWORDS.has(t.toLowerCase()) ? t.toLowerCase() : "ID";
    return t;
  });
}

export function shingles(tokens: string[], n = 5) {
  const s = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i++) s.add(tokens.slice(i, i + n).join(" "));
  return s;
}

export function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface Submission {
  itemId: string;
  attemptId: string;
  templateId: string;
  code: string;
}

export const PLAGIARISM_RULE = { minTokens: 40, threshold: 0.8 } as const;

/** Clusters of near-identical solutions to the same template from different attempts. */
export function findClusters(subs: Submission[], rule = PLAGIARISM_RULE) {
  const byTemplate = new Map<string, (Submission & { sh: Set<string> })[]>();
  for (const s of subs) {
    const toks = normalizeCode(s.code);
    if (toks.length < rule.minTokens) continue;
    byTemplate.set(s.templateId, [...(byTemplate.get(s.templateId) ?? []), { ...s, sh: shingles(toks) }]);
  }
  const clusters: { templateId: string; members: Submission[]; similarity: number }[] = [];
  for (const [templateId, list] of byTemplate) {
    const parent = list.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
    const sim = new Map<number, number>();
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        if (list[i]!.attemptId === list[j]!.attemptId) continue;
        const v = jaccard(list[i]!.sh, list[j]!.sh);
        if (v >= rule.threshold) {
          parent[find(i)] = find(j);
          sim.set(i, Math.max(sim.get(i) ?? 0, v));
          sim.set(j, Math.max(sim.get(j) ?? 0, v));
        }
      }
    const groups = new Map<number, number[]>();
    list.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
    for (const idx of groups.values()) {
      if (idx.length < 2) continue;
      clusters.push({
        templateId,
        members: idx.map((i) => ({ itemId: list[i]!.itemId, attemptId: list[i]!.attemptId, templateId, code: list[i]!.code })),
        similarity: Math.max(...idx.map((i) => sim.get(i) ?? 0)),
      });
    }
  }
  return clusters.sort((a, b) => b.members.length - a.members.length || b.similarity - a.similarity);
}
