import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { seedDemoData, DEMO_PASSWORD } from "./seed-data";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function main() {
  console.log("Seeding CM Repository demo data...");
  const { usersSeed } = await seedDemoData(db);
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
