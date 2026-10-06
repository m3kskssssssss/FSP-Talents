import { describe, expect, it } from "vitest";
import { findClusters, jaccard, normalizeCode, shingles } from "@/server/testing/plagiarism";

const a = `def accept(times):
    # sliding window
    acc = []
    out = []
    for t in times:
        while acc and acc[0] <= t - 10:
            acc.pop(0)
        if len(acc) < 3:
            acc.append(t)
            out.append(True)
        else:
            out.append(False)
    return out
`;
// Same solution with renamed variables and other comments.
const b = a.replace(/acc/g, "window").replace(/out/g, "result").replace("# sliding window", "# мой код");
const c = `def accept(times):
    from collections import deque
    q = deque()
    res = [False] * len(times)
    i = 0
    for idx, t in enumerate(times):
        while q and q[0] <= t - 10:
            q.popleft()
        if len(q) >= 3:
            continue
        q.append(t)
        res[idx] = True
    return res
`;

describe("solution similarity", () => {
  it("is robust to renaming and comments, but separates different solutions", () => {
    const sa = shingles(normalizeCode(a));
    expect(jaccard(sa, shingles(normalizeCode(b)))).toBe(1);
    expect(jaccard(sa, shingles(normalizeCode(c)))).toBeLessThan(0.5);
  });

  it("clusters near-identical submissions from different attempts", () => {
    const cl = findClusters([
      { itemId: "1", attemptId: "A", templateId: "t", code: a },
      { itemId: "2", attemptId: "B", templateId: "t", code: b },
      { itemId: "3", attemptId: "C", templateId: "t", code: c },
    ]);
    expect(cl).toHaveLength(1);
    expect(cl[0]!.members.map((m) => m.attemptId).sort()).toEqual(["A", "B"]);
  });
});
