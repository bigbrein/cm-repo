import "server-only";
import { isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cmDocuments } from "@/db/schema";
import { getStorageAdapter } from "@/lib/storage";
import { seedDemoData } from "@/db/seed-data";

// Public-demo self-heal: wipe every table back to empty and reseed the
// baseline departments/document types/demo users/employees, on a schedule
// (see the /api/cron/reset-demo route + vercel.json). Without this, a
// public demo with shared write access just degrades over time as visitors
// upload junk, delete records, or empty the queue — there's no "my session"
// isolation to fall back on.
//
// TRUNCATE (not DELETE) is deliberate: the audit_log table has a DB-level
// trigger blocking UPDATE/DELETE (see drizzle/0001_audit_log_immutability.sql)
// so the append-only guarantee holds against the running application — but
// that trigger only fires on row-level DELETE, not on TRUNCATE, which is the
// right escape hatch for this kind of full infra-level reset rather than a
// gap in that guarantee.
export async function resetDemoData(): Promise<{ deletedFiles: number; deletedFileErrors: number }> {
  const storage = getStorageAdapter();

  const filesToDelete = await db
    .select({ fileKey: cmDocuments.fileKey })
    .from(cmDocuments)
    .where(isNotNull(cmDocuments.fileKey));

  let deletedFiles = 0;
  let deletedFileErrors = 0;
  for (const { fileKey } of filesToDelete) {
    if (!fileKey) continue;
    try {
      await storage.deleteObject(fileKey);
      deletedFiles++;
    } catch (error) {
      // A stray object outliving its DB row isn't worth failing the whole
      // reset over — log it and keep going so the DB (the part visitors
      // actually see) still gets reset on schedule.
      deletedFileErrors++;
      console.error(`demo reset: failed to delete stored file ${fileKey}:`, error);
    }
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      TRUNCATE TABLE
        "cm_document", "upload_session", "document_sequence", "audit_log",
        "employee", "department", "document_type", "rate_limit_bucket",
        "account", "session", "verification_token", "user"
      RESTART IDENTITY CASCADE
    `);
    await seedDemoData(tx);
  });

  return { deletedFiles, deletedFileErrors };
}
