import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { TEST_DATABASE_URL } from "./env";

export default async function setup() {
  const sql = postgres(TEST_DATABASE_URL, { onnotice: () => {}, max: 1 });
  await sql`DROP SCHEMA IF EXISTS public CASCADE`;
  await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
  await sql`CREATE SCHEMA public`;
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  await sql.end();
}
