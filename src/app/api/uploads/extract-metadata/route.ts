import type { NextRequest } from "next/server";
import { withApiAuth } from "@/lib/session";
import { suggestMetadataFromFileName } from "@/lib/metadata-extraction";

// FR-UPL-5: async metadata extraction — modeled as a server round-trip
// (even though today's heuristic only needs the filename) so a future
// real content-based extractor (PDF/DOCX text parsing) is a drop-in
// change behind this same endpoint. Suggestions only; nothing is saved.
export async function POST(request: NextRequest) {
  return withApiAuth(
    async () => {
      const { fileName } = (await request.json().catch(() => ({}))) as { fileName?: string };
      if (!fileName) return Response.json({ error: "fileName is required" }, { status: 400 });
      return Response.json({ suggestion: suggestMetadataFromFileName(fileName) });
    },
    { permission: "canUploadDocuments" }
  );
}
