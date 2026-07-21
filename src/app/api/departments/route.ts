import { withApiAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return withApiAuth(async () => {
    const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
    return Response.json({ departments });
  });
}
