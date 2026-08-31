import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";

// Drizzle replaces Prisma here — see src/db/schema.ts and drizzle.config.ts
// for the corresponding schema/migration setup. DATABASE_URL points at
// PostgreSQL per SRS §2.4 / §5 (System Architecture), and works with any
// Postgres-compatible host (Neon, Supabase, Railway, RDS, self-hosted, ...).
const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const pool = globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });

// The type Drizzle hands a `db.transaction(async (tx) => ...)` callback —
// used by call sites (lib/naming.ts, lib/documents.ts) that accept either
// the top-level `db` or an in-flight transaction, mirroring the old
// `Prisma.TransactionClient | typeof prisma` parameter pattern.
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbClient = typeof db | Transaction;
