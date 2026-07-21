import type { NextRequest } from "next/server";
import { withApiAuth } from "@/lib/session";
import { appendChunk } from "@/lib/chunked-upload";

// FR-UPL-10: one chunk of a large file, sent sequentially by the client
// and appended to a staging file (see lib/chunked-upload.ts).
export async function POST(request: NextRequest) {
  return withApiAuth(
    async () => {
      const formData = await request.formData();
      const uploadId = String(formData.get("uploadId") ?? "");
      const chunk = formData.get("chunk");

      if (!uploadId || !(chunk instanceof Blob)) {
        return Response.json({ error: "uploadId and chunk are required" }, { status: 400 });
      }

      const buffer = Buffer.from(await chunk.arrayBuffer());
      await appendChunk(uploadId, buffer);

      return Response.json({ ok: true });
    },
    { permission: "canUploadDocuments" }
  );
}
