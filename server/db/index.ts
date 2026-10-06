import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

const globalForDb = globalThis as unknown as { __db?: Db; __sql?: postgres.Sql };

function create(): Db {
  const sql = postgres(env().DATABASE_URL, {
    // Neon pooler (pgbouncer, transaction mode) does not support prepared statements.
    prepare: false,
    max: process.env.VERCEL ? 1 : 10,
    idle_timeout: 20,
    onnotice: () => {},
  });
  globalForDb.__sql = sql;
  return drizzle(sql, { schema });
}

/** Lazily created singleton; survives Next.js dev hot reloads. */
export function db(): Db {
  if (!globalForDb.__db) globalForDb.__db = create();
  return globalForDb.__db;
}

export async function closeDb() {
  await globalForDb.__sql?.end({ timeout: 5 });
  globalForDb.__db = undefined;
  globalForDb.__sql = undefined;
}

export { schema };
