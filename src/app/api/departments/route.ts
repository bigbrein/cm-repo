import { asc } from "drizzle-orm";
import { withApiAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { departments as departmentsTable } from "@/db/schema";

export async function GET() {
  return withApiAuth(async () => {
    const departments = await db.select().from(departmentsTable).orderBy(asc(departmentsTable.name));
    return Response.json({ departments });
  });
}
