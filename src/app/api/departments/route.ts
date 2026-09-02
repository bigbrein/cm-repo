import type { NextRequest } from "next/server";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { withApiAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { departments as departmentsTable } from "@/db/schema";

export async function GET() {
  return withApiAuth(async () => {
    const departments = await db.select().from(departmentsTable).orderBy(asc(departmentsTable.name));
    return Response.json({ departments });
  });
}

const CreateSchema = z.object({
  name: z.string().min(2).max(100),
});

function deriveDepartmentCode(name: string, taken: Set<string>): string {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "DEPT";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// Manual-entry fallback mirroring the employee one (FR-SF-7): a department
// named in an extracted CM that doesn't match anything in the lookup list
// yet. Restricted to roles that can upload documents, since this only
// exists to unblock that flow — full department management (renaming,
// merging) stays an admin/DB concern.
export async function POST(request: NextRequest) {
  return withApiAuth(
    async () => {
      const body = await request.json().catch(() => null);
      const parsed = CreateSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
      }
      const name = parsed.data.name.trim();

      const existing = await db.select().from(departmentsTable);
      if (existing.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
        return Response.json({ error: "A department with this name already exists" }, { status: 409 });
      }

      const code = deriveDepartmentCode(name, new Set(existing.map((d) => d.code)));
      const [department] = await db.insert(departmentsTable).values({ name, code }).returning();

      return Response.json({ department }, { status: 201 });
    },
    { permission: "canUploadDocuments" }
  );
}
