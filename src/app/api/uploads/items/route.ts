import type { NextRequest } from "next/server";
import { withApiAuth } from "@/lib/session";
import { createCmDocument, UploadValidationError } from "@/lib/documents";
import { finalizeChunkedUpload } from "@/lib/chunked-upload";

// FR-UPL-1/7/8: creates one CM Document from one batch item — either an
// uploaded file (direct or assembled from chunks, FR-UPL-10) or composed
// letter text (FR-UPL-3). The client has already shown the user the
// auto-populated/extracted values and this call only fires once they
// confirm (FR-UPL-7); nothing is persisted before that.
export async function POST(request: NextRequest) {
  return withApiAuth(
    async (user) => {
      const formData = await request.formData();

      const employeeId = String(formData.get("employeeId") ?? "");
      const documentTypeId = String(formData.get("documentTypeId") ?? "");
      const validPeriodMonths = Number(formData.get("validPeriodMonths"));
      const dateIssuedRaw = String(formData.get("dateIssued") ?? "");
      const uploadSessionId = formData.get("uploadSessionId") ? String(formData.get("uploadSessionId")) : null;
      const bodyHtml = formData.get("bodyHtml") ? String(formData.get("bodyHtml")) : null;
      const tempUploadId = formData.get("tempUploadId") ? String(formData.get("tempUploadId")) : null;
      const filePart = formData.get("file");

      const dateIssued = new Date(dateIssuedRaw);
      if (!employeeId || !documentTypeId || !Number.isFinite(validPeriodMonths) || Number.isNaN(dateIssued.getTime())) {
        return Response.json({ error: "Missing or invalid required fields" }, { status: 400 });
      }

      let file: { buffer: Buffer; fileName: string; mimeType: string } | null = null;
      if (tempUploadId) {
        const buffer = await finalizeChunkedUpload(tempUploadId);
        const fileName = String(formData.get("fileName") ?? "upload.bin");
        const mimeType = String(formData.get("fileMimeType") ?? "application/octet-stream");
        file = { buffer, fileName, mimeType };
      } else if (filePart instanceof Blob && filePart.size > 0) {
        const buffer = Buffer.from(await filePart.arrayBuffer());
        file = {
          buffer,
          fileName: (filePart as File).name ?? "upload.bin",
          mimeType: filePart.type || "application/octet-stream",
        };
      }

      try {
        const document = await createCmDocument(user, {
          employeeId,
          documentTypeId,
          validPeriodMonths,
          dateIssued,
          uploadSessionId,
          file,
          bodyHtml,
        });
        return Response.json({ document }, { status: 201 });
      } catch (error) {
        if (error instanceof UploadValidationError) {
          return Response.json({ error: error.message }, { status: 422 });
        }
        throw error;
      }
    },
    { permission: "canUploadDocuments" }
  );
}
