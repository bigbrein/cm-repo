// FR-UPL-5: attempt asynchronous metadata extraction from an uploaded file
// and pre-populate the form with detected values, without persisting
// anything until the user confirms (FR-UPL-7). Two signals feed this:
// the filename (a loose heuristic) and, for PDFs, the document's own text
// (extracted via unpdf) scanned for "Label: value" lines. CM templates
// vary a lot between organizations, so this is a best-effort heuristic
// tuned to common HR-letter conventions, not a guarantee — every extracted
// field is only ever a pre-filled suggestion the user can edit or ignore.

export interface ExtractedMetadataSuggestion {
  documentTypeCode: string | null;
  employeeIdHint: string | null;
}

export interface ExtractedEmployeeCandidate {
  fullName: string | null;
  employeeId: string | null;
  department: string | null;
  jobTitle: string | null;
}

const TYPE_KEYWORDS: { pattern: RegExp; code: string }[] = [
  // Checked before WRITTEN so a "Final Written Warning" filename doesn't
  // get misclassified as a plain Written Warning.
  { pattern: /final[\s_-]?(written[\s_-]?)?warning/i, code: "FINAL" },
  { pattern: /written[\s_-]?warning/i, code: "WRITTEN" },
  { pattern: /verbal[\s_-]?warning/i, code: "VERBAL" },
  { pattern: /suspension/i, code: "SUSPENSION" },
  { pattern: /\bpip\b/i, code: "PIP" },
  { pattern: /termination/i, code: "TERMINATION" },
];

export function detectDocumentTypeCode(text: string): string | null {
  return TYPE_KEYWORDS.find((t) => t.pattern.test(text))?.code ?? null;
}

export function suggestMetadataFromFileName(fileName: string): ExtractedMetadataSuggestion {
  // Loose heuristic: a 4-8 digit run in the filename is often an employee ID
  // (e.g. "CM_10234_final-warning.pdf"). Treated as a hint only — FR-UPL-7
  // still requires the user to confirm the actual employee via the picker.
  const idMatch = fileName.match(/(?<!\d)(\d{4,8})(?!\d)/);

  return {
    documentTypeCode: detectDocumentTypeCode(fileName),
    employeeIdHint: idMatch?.[1] ?? null,
  };
}

// Ordered most-specific-first within each field so e.g. "Employee ID" wins
// over a bare "ID", and "Issued by"/"Manager" never get mistaken for the
// employee's own name.
const FIELD_LABELS: { field: keyof ExtractedEmployeeCandidate; pattern: RegExp }[] = [
  { field: "employeeId", pattern: /^(employee\s*(?:id|no\.?|number)|emp\.?\s*id|staff\s*id|personnel\s*(?:no\.?|number))\s*[:\-]\s*(.+)$/i },
  { field: "fullName", pattern: /^(employee\s*name|name\s*of\s*employee)\s*[:\-]\s*(.+)$/i },
  { field: "department", pattern: /^(department|dept\.?|division)\s*[:\-]\s*(.+)$/i },
  { field: "jobTitle", pattern: /^(job\s*title|position|designation)\s*[:\-]\s*(.+)$/i },
];

// A bare "Name:" or "Employee:" line is a weaker/ambiguous signal (could be
// the issuer, a witness, etc. in some templates) — only used if the
// stronger "Employee Name:" label above never matches anywhere in the doc.
const FALLBACK_NAME_PATTERN = /^(name|employee)\s*[:\-]\s*(.+)$/i;

/**
 * Scans PDF-extracted text line by line for "Label: value" rows matching
 * common CM/HR-letter conventions. Best-effort only — templates that don't
 * use this label:value layout (e.g. narrative-only letters) will simply
 * yield no matches, and every field the caller gets back is null.
 */
export function extractEmployeeCandidateFromText(text: string): ExtractedEmployeeCandidate {
  const candidate: ExtractedEmployeeCandidate = {
    fullName: null,
    employeeId: null,
    department: null,
    jobTitle: null,
  };

  let fallbackName: string | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    for (const { field, pattern } of FIELD_LABELS) {
      if (candidate[field]) continue;
      const match = line.match(pattern);
      if (match) {
        candidate[field] = cleanValue(match[2]!);
      }
    }

    if (!fallbackName && !candidate.fullName) {
      const match = line.match(FALLBACK_NAME_PATTERN);
      if (match) fallbackName = cleanValue(match[2]!);
    }
  }

  if (!candidate.fullName && fallbackName) {
    candidate.fullName = fallbackName;
  }

  return candidate;
}

function cleanValue(value: string): string | null {
  // Table-cell extraction can leave trailing pipes/tabs or a repeated
  // adjacent column; keep it to the first sensible chunk of text.
  const cleaned = value.replace(/[|\t]+.*$/, "").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 200) : null;
}

/** Splits a full name into first/last for the manual-entry form (BR-agnostic — CMs don't standardize name order). */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1)! };
}
