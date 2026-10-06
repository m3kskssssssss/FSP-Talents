import { sql } from "drizzle-orm";
import { db } from "@/server/db";

/** Truncates every application table (keeps the migration journal). */
export async function resetDb() {
  const rows = await db().execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const names = rows.map((r) => `"${r.tablename}"`).join(", ");
  if (names) await db().execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
}
