import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { seedDemoData, DEMO_PASSWORD } from "./seed-data";
import { seedSampleDocuments } from "./seed-sample-documents";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function main() {
  console.log("Seeding CM Repository demo data...");
  const { usersSeed } = await seedDemoData(db);
  // Reads back through the app's own shared db client (lib/db.ts) rather
  // than this script's own pool — safe because the inserts above already
  // committed (no explicit transaction wraps them), so they're visible on
  // any connection by the time this runs.
  await seedSampleDocuments();
  console.log("Seed complete.");
  console.log(`Demo accounts (password: ${DEMO_PASSWORD}):`);
  for (const u of usersSeed) console.log(`  - ${u.email}  [${u.role}]`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
