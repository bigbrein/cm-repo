import { withApiAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return withApiAuth(async () => {
    const documentTypes = await prisma.documentType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return Response.json({ documentTypes });
  });
}
