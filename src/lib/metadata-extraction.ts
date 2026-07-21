// FR-UPL-5: attempt asynchronous metadata extraction from an uploaded file
// and pre-populate the form with detected values, without persisting
// anything until the user confirms (FR-UPL-7). This is a filename-based
// heuristic rather than full document-content parsing (OCR/NLP is out of
// scope for the MVP) — a real deployment could extend this with actual
// PDF/DOCX text extraction while keeping the same "suggestion only" contract.

export interface ExtractedMetadataSuggestion {
  documentTypeCode: string | null;
  employeeIdHint: string | null;
}

const TYPE_KEYWORDS: { pattern: RegExp; code: string }[] = [
  { pattern: /final[\s_-]?warning/i, code: "FINAL" },
  { pattern: /written[\s_-]?warning/i, code: "WRITTEN" },
  { pattern: /verbal[\s_-]?warning/i, code: "VERBAL" },
];

export function suggestMetadataFromFileName(fileName: string): ExtractedMetadataSuggestion {
  const typeMatch = TYPE_KEYWORDS.find((t) => t.pattern.test(fileName));
  // Loose heuristic: a 4-8 digit run in the filename is often an employee ID
  // (e.g. "CM_10234_final-warning.pdf"). Treated as a hint only — FR-UPL-7
  // still requires the user to confirm the actual employee via the picker.
  const idMatch = fileName.match(/\b(\d{4,8})\b/);

  return {
    documentTypeCode: typeMatch?.code ?? null,
    employeeIdHint: idMatch?.[1] ?? null,
  };
}
