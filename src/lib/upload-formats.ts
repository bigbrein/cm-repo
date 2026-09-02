import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { extractDocxText, convertDocxToHtml } from "@/lib/docx";
import { extractRtfText } from "@/lib/rtf";
import {
  markdownTableRowsToLabelValueLines,
  markdownToHtml,
  extractHtmlText,
  extractHtmlBodyMarkup,
  plainTextToHtml,
} from "@/lib/document-formats";
import { htmlToPdfBuffer } from "@/lib/pdf";

// Every CM Document upload format this app accepts (FR-UPL-5 extraction and
// FR-REC-1 always-PDF storage both dispatch off this single list, so
// supporting a new format only ever means adding one entry here).
export type UploadFormat = "pdf" | "docx" | "txt" | "md" | "html" | "rtf";

const EXTENSION_FORMATS: Record<string, UploadFormat> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".txt": "txt",
  ".md": "md",
  ".markdown": "md",
  ".html": "html",
  ".htm": "html",
  ".rtf": "rtf",
};

const MIME_FORMATS: Record<string, UploadFormat> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/html": "html",
  "application/rtf": "rtf",
  "text/rtf": "rtf",
};

/**
 * Detected from the filename extension first — the most reliable signal
 * for a user-picked file, since browsers report inconsistent or generic
 * MIME types (or none at all) for less common formats like .md/.rtf — and
 * falling back to the browser-reported MIME type only when the extension
 * doesn't match anything.
 */
export function detectUploadFormat(fileName: string, mimeType: string): UploadFormat | null {
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
  return EXTENSION_FORMATS[ext] ?? MIME_FORMATS[mimeType] ?? null;
}

/**
 * Extracts a plain-text rendition for the metadata scanner (FR-UPL-5).
 * Table-style "label | value" layouts — Markdown pipe tables, HTML meta
 * tables, DOCX table cells — all collapse down to the same "Label: value"
 * line convention lib/metadata-extraction.ts's scanner looks for.
 */
export async function extractTextForMetadata(format: UploadFormat, buffer: Buffer): Promise<string> {
  switch (format) {
    case "pdf": {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      return (await extractText(pdf, { mergePages: true })).text;
    }
    case "docx":
      return extractDocxText(buffer);
    case "txt":
      return buffer.toString("utf-8");
    case "md":
      return markdownTableRowsToLabelValueLines(buffer.toString("utf-8"));
    case "html":
      return extractHtmlText(buffer.toString("utf-8"));
    case "rtf":
      return extractRtfText(buffer);
  }
}

/**
 * Converts an upload to the PDF bytes actually stored/downloaded (FR-REC-1
 * — every CM Document is stored and downloaded as PDF). A PDF upload
 * passes through unchanged; everything else renders through the same
 * HTML-to-PDF pipeline (lib/pdf.ts). RTF has no direct HTML rendering here
 * — it's flattened to plain text like a .txt upload, trading its original
 * visual styling (bold labels, colors) for guaranteed, faithful text
 * content, rather than taking on a full RTF-to-HTML renderer for the one
 * format that needs it.
 */
export async function convertUploadToPdf(format: UploadFormat, buffer: Buffer): Promise<Buffer> {
  if (format === "pdf") return buffer;

  let html: string;
  switch (format) {
    case "docx":
      html = await convertDocxToHtml(buffer);
      break;
    case "txt":
      html = plainTextToHtml(buffer.toString("utf-8"));
      break;
    case "md":
      html = markdownToHtml(buffer.toString("utf-8"));
      break;
    case "html":
      html = extractHtmlBodyMarkup(buffer.toString("utf-8"));
      break;
    case "rtf":
      html = plainTextToHtml(await extractRtfText(buffer));
      break;
  }
  return htmlToPdfBuffer(html);
}
