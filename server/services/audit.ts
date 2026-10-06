import type { DbOrTx } from "../db";
import { auditLog } from "../db/schema";

/** Audit trail for actions with personal data. Never put PII into `meta`. */
export async function audit(
  tx: DbOrTx,
  e: { actorUserId: string | null; action: string; entity: string; entityId?: string; meta?: Record<string, unknown> },
) {
  await tx.insert(auditLog).values({ ...e, entityId: e.entityId ?? null });
}
