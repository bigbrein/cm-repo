import type { NextRequest } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { withApiAuth } from "@/lib/session";
import {
  suggestMetadataFromFileName,
  detectDocumentTypeCode,
  extractEmployeeCandidateFromText,
  type ExtractedEmployeeCandidate,
} from "@/lib/metadata-extraction";
import { extractDocxText } from "@/lib/docx";

// FR-UPL-5: async metadata extraction, pre-populating the form without
// persisting anything (FR-UPL-7 still requires explicit user confirmation).
// Two signals: the filename (always) and, for PDFs/Word docs under the size
// cap, the document's own text — scanned for "Label: value" lines. CM
// templates vary a lot between organizations, so content extraction is
// best-effort: a narrative-only letter with no label:value layout just
// yields nulls, and the client only ever treats these as an editable
// suggestion.
const MAX_CONTENT_EXTRACTION_BYTES = 15 * 1024 * 1024;
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(request: NextRequest) {
  return withApiAuth(
    async () => {
      const formData = await request.formData();
      const filePart = formData.get("file");
      const fileName =
        (filePart instanceof Blob ? (filePart as File).name : null) ?? String(formData.get("fileName") ?? "");
      if (!fileName) return Response.json({ error: "fileName is required" }, { status: 400 });

      const nameHeuristic = suggestMetadataFromFileName(fileName);
      let documentTypeCode = nameHeuristic.documentTypeCode;
      let employee: ExtractedEmployeeCandidate | null = null;

      const isPdf = filePart instanceof Blob && (filePart.type === "application/pdf" || /\.pdf$/i.test(fileName));
      const isDocx = filePart instanceof Blob && (filePart.type === DOCX_MIME_TYPE || /\.docx$/i.test(fileName));
      const withinSizeCap = filePart instanceof Blob && filePart.size > 0 && filePart.size <= MAX_CONTENT_EXTRACTION_BYTES;

      if (filePart instanceof Blob && withinSizeCap && (isPdf || isDocx)) {
        try {
          const text = isPdf
            ? await (async () => {
                const bytes = new Uint8Array(await filePart.arrayBuffer());
                const pdf = await getDocumentProxy(bytes);
                return (await extractText(pdf, { mergePages: true })).text;
              })()
            : await extractDocxText(Buffer.from(await filePart.arrayBuffer()));

          documentTypeCode = detectDocumentTypeCode(text) ?? documentTypeCode;
          const candidate = extractEmployeeCandidateFromText(text);
          if (candidate.fullName || candidate.employeeId) {
            employee = candidate;
          }
        } catch (error) {
          // Malformed/unreadable file (e.g. a scanned-image PDF) — fall back
          // to the filename-only suggestion rather than failing the request.
          console.error("Document metadata extraction failed:", error);
        }
      }

      return Response.json({
        suggestion: {
          documentTypeCode,
          employeeIdHint: nameHeuristic.employeeIdHint,
          employee,
        },
      });
    },
    { permission: "canUploadDocuments" }
  );
}
