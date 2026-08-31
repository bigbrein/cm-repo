import { asc, eq } from "drizzle-orm";
import { withApiAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { documentTypes as documentTypesTable } from "@/db/schema";

export async function GET() {
  return withApiAuth(async () => {
    const documentTypes = await db
      .select()
      .from(documentTypesTable)
      .where(eq(documentTypesTable.isActive, true))
      .orderBy(asc(documentTypesTable.sortOrder));
    return Response.json({ documentTypes });
  });
}
