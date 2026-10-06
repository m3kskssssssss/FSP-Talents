import { Badge } from "@/components/ui/badge";

const T = { high: ["high · доверие", "ok"], medium: ["medium · с пометкой", "warn"], low: ["low · перепроверка", "red"] } as const;

export function TrustBadge({ level, index }: { level: "high" | "medium" | "low" | null; index?: number | null }) {
  if (!level) return <Badge tone="gray">—</Badge>;
  return (
    <Badge tone={T[level][1]}>
      {T[level][0]}
      {index !== undefined && index !== null ? ` · ${Math.round(index)}` : ""}
    </Badge>
  );
}
