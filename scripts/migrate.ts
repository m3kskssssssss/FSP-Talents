import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, db } from "../server/db";

async function main() {
  await migrate(db(), { migrationsFolder: "./drizzle" });
  console.log("migrations applied");
  await closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
