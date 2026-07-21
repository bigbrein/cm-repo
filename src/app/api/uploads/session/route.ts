import { withApiAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// FR-UPL-1: groups a single/multi-file upload batch (BR-5: still one
// CmDocument row per file/entry underneath).
export async function POST() {
  return withApiAuth(
    async (user) => {
      const session = await prisma.uploadSession.create({ data: { createdById: user.id } });
      return Response.json({ uploadSessionId: session.id }, { status: 201 });
    },
    { permission: "canUploadDocuments" }
  );
}
