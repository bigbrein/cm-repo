import "server-only";
import mammoth from "mammoth";

// Word (.docx) support for the same two things PDFs already get: best-effort
// metadata extraction (raw text) and, since CM Documents are always stored
// and downloaded as PDF, a rendition to convert to PDF (HTML, handed to
// lib/pdf.ts).

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

export async function convertDocxToHtml(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.convertToHtml({ buffer });
  return value;
}
