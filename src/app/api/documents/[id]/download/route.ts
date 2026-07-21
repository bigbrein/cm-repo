import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/session";
import { getAccessibleDocument } from "@/lib/document-access";
import { getStorageAdapter } from "@/lib/storage";
import { signDownloadToken, verifyDownloadToken } from "@/lib/download-tokens";
import { writeAuditLog, requestMetadata } from "@/lib/audit";

const DOWNLOAD_TOKEN_TTL_SECONDS = 5 * 60; // FR-REC-5 / NFR-SEC-5: time-limited

// FR-REC-1/5, NFR-SEC-2/5: every hit re-checks the session's RBAC and
// department scope — the signed token alone never grants access. A
// request with no token gets redirected to one carrying a fresh,
// short-lived signature; a request with a token streams the file only if
// that signature is still valid.
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await requireUser().catch(() => null);
  if (!user) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!user.permissions.canDownloadDocuments) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const document = await getAccessibleDocument(user, id);
  if (!document) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    const { token: freshToken } = signDownloadToken(document.id, DOWNLOAD_TOKEN_TTL_SECONDS);
    const redirectUrl = new URL(request.url);
    redirectUrl.searchParams.set("token", freshToken);
    return Response.redirect(redirectUrl, 302);
  }

  if (!verifyDownloadToken(document.id, token)) {
    return Response.json({ error: "This download link has expired. Reopen it from the dashboard." }, { status: 403 });
  }

  const { ipAddress, userAgent } = requestMetadata(request);
  await writeAuditLog({
    action: "DOCUMENT_DOWNLOAD",
    actorUserId: user.id,
    actorEmail: user.email,
    cmDocumentId: document.id,
    targetType: "CmDocument",
    targetId: document.id,
    ipAddress,
    userAgent,
  });

  if (document.fileKey) {
    const storage = getStorageAdapter();
    const { data, contentType } = await storage.getObjectBuffer(document.fileKey);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType || document.fileMimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${document.documentName}-${document.fileName ?? "document"}"`,
      },
    });
  }

  // FR-REC-1: "the source file OR generated document" — composed letters
  // (FR-UPL-3) have no source file, so a downloadable HTML rendition is
  // generated on the fly instead of requiring a full PDF pipeline for MVP.
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${document.documentName}</title></head><body>${document.bodyHtml ?? ""}</body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${document.documentName}.html"`,
    },
  });
}
