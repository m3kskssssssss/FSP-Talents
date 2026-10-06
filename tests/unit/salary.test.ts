import { describe, expect, it } from "vitest";
import { z } from "zod";
import { withSalaryRange } from "@/server/schemas/common";

const schema = withSalaryRange({ title: z.string() });

describe("salary range (hard rule #1)", () => {
  it("accepts a valid integer range", () => {
    expect(schema.safeParse({ title: "x", salaryFrom: 150000, salaryTo: 200000 }).success).toBe(true);
    expect(schema.safeParse({ title: "x", salaryFrom: 150000, salaryTo: 150000 }).success).toBe(true);
  });
  it.each([
    [{ title: "x" }, "missing"],
    [{ title: "x", salaryFrom: 100000 }, "missing to"],
    [{ title: "x", salaryFrom: 0, salaryTo: 100 }, "zero"],
    [{ title: "x", salaryFrom: -5, salaryTo: 100 }, "negative"],
    [{ title: "x", salaryFrom: 100.5, salaryTo: 200 }, "fraction"],
    [{ title: "x", salaryFrom: 300000, salaryTo: 200000 }, "from > to"],
    [{ title: "x", salaryFrom: "100000", salaryTo: 200000 }, "string"],
  ] as [unknown, string][])("rejects %j (%s)", (input) => {
    expect(schema.safeParse(input).success).toBe(false);
  });
});
