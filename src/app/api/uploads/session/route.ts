import { withApiAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { uploadSessions } from "@/db/schema";

// FR-UPL-1: groups a single/multi-file upload batch (BR-5: still one
// CmDocument row per file/entry underneath).
export async function POST() {
  return withApiAuth(
    async (user) => {
      const [session] = await db.insert(uploadSessions).values({ createdById: user.id }).returning();
      return Response.json({ uploadSessionId: session!.id }, { status: 201 });
    },
    { permission: "canUploadDocuments" }
  );
}
