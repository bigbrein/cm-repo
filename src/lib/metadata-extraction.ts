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
  email: string | null;
}

export interface ExtractedDocumentDetails {
  dateIssued: string | null; // ISO date, YYYY-MM-DD (no time — the source text never carries one)
  validPeriodMonths: number | null;
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

// Only the document's opening (company name + type heading, per every
// sample template) is scanned, not the full body — otherwise a letter's own
// boilerplate mentioning a harsher escalation path in passing (e.g. "may
// result in a final written warning or dismissal") gets misdetected as that
// harsher type. A no-op for the filename-only heuristic, whose input is
// already just one line.
const HEADING_LINES_SCANNED = 4;

export function detectDocumentTypeCode(text: string): string | null {
  const headingLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, HEADING_LINES_SCANNED);

  // Checked line-by-line (earliest line wins) rather than against the whole
  // window jointly — a subtitle line naming the grounds for the current
  // notice (e.g. a termination letter's "For Cause — Following Final
  // Written Warning") can otherwise outrank the actual title on the line
  // before it, purely because TYPE_KEYWORDS happens to check that keyword
  // first.
  for (const line of headingLines) {
    const match = TYPE_KEYWORDS.find((t) => t.pattern.test(line));
    if (match) return match.code;
  }

  // Checkbox-style forms (e.g. "STAGE OF DISCIPLINARY PROCESS (tick one)")
  // mark the type via a checked box next to it rather than a heading, often
  // well past the opening lines. A checked box is an explicit, deliberate
  // selection rather than incidental prose, so it's safe to search the
  // whole document for it — unlike the heading-only scan above, which
  // exists specifically to avoid a letter's own body text (e.g. "may result
  // in a final written warning") being mistaken for its actual type.
  for (const rawLine of text.split(/\r?\n/)) {
    const boxMatch = rawLine.trim().match(CHECKED_BOX_LINE_PATTERN);
    if (!boxMatch) continue;
    const match = TYPE_KEYWORDS.find((t) => t.pattern.test(boxMatch[1]!));
    if (match) return match.code;
  }

  // Memo-style letters put the type in a "RE: Verbal warning — safety
  // violation" line below a TO/FROM/DATE header block, which can push it
  // past the heading window entirely. Like the checkbox case above, an
  // explicit "RE:"/"Subject:" line is a deliberate label, not incidental
  // prose, so it's safe to search the whole document for it.
  for (const rawLine of text.split(/\r?\n/)) {
    const reMatch = rawLine.trim().match(RE_OR_SUBJECT_LINE_PATTERN);
    if (!reMatch) continue;
    const match = TYPE_KEYWORDS.find((t) => t.pattern.test(reMatch[1]!));
    if (match) return match.code;
  }

  // A formal address block (name / "Employee ID X" / "Title, Department")
  // can push the actual title line several lines past the heading window,
  // but it always sits directly above the "Dear Name," salutation that
  // follows it — a deliberate title line, not incidental prose, since body
  // text is never immediately followed by a fresh letter salutation.
  const nonBlankLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = 1; i < nonBlankLines.length; i++) {
    if (!DEAR_NAME_LINE_PATTERN.test(nonBlankLines[i]!)) continue;
    const match = TYPE_KEYWORDS.find((t) => t.pattern.test(nonBlankLines[i - 1]!));
    if (match) return match.code;
  }
  return null;
}

const CHECKED_BOX_LINE_PATTERN = /^[☒✓✔]\s*(.+)$/;
const RE_OR_SUBJECT_LINE_PATTERN = /^(?:re|subject):\s*(.+)$/i;

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
  { field: "email", pattern: /^(employee\s*e-?mail|e-?mail(?:\s*address)?)\s*[:\-]\s*(.+)$/i },
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
    email: null,
  };

  let fallbackName: string | null = null;

  const preprocessed = mergeBareLabelLines(
    synthesizeFromNarrativeDetails(synthesizeFromAddressBlock(synthesizeFromSalutationLine(text)))
  );

  for (const rawLine of preprocessed.split(/\r?\n/)) {
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

// Word (.docx) table cells extract as one paragraph per cell (e.g. "Employee
// name:" and "Michael Obi" on separate lines), unlike PDF text extraction
// which keeps a table row's cells on one visual line. Some form-style
// templates go further and drop the colon entirely — a bare "Employee name"
// cell followed by "Damilola Adeleke" in the next paragraph — so this
// matches known field-label text on its own, not just a trailing ":"/"-".
// A no-op for text that already has same-line "Label: value" pairs, so this
// is safe to run unconditionally for both PDF- and DOCX-sourced text.
const BARE_LABEL_TEXT_PATTERN =
  /^(?:employee\s*(?:id|no\.?|number)|emp\.?\s*id|staff\s*id|personnel\s*(?:no\.?|number)|employee\s*name|name\s*of\s*employee|department|dept\.?|division|job\s*title|position|designation|employee\s*e-?mail|e-?mail(?:\s*address)?|date\s*issued|issue\s*date|issued\s*(?:on|date)|date\s*of\s*issue|letter\s*date)\s*[:\-]?\s*$/i;

function mergeBareLabelLines(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line) continue;
    const isBareLabel = BARE_LABEL_TEXT_PATTERN.test(line);
    if (isBareLabel) {
      let j = i + 1;
      while (j < lines.length && !lines[j]) j++;
      if (j < lines.length) {
        const hasTrailingPunctuation = /[:\-]\s*$/.test(line);
        merged.push(hasTrailingPunctuation ? `${line} ${lines[j]}` : `${line}: ${lines[j]}`);
        i = j;
        continue;
      }
    }
    merged.push(line);
  }
  return merged.join("\n");
}

// Plain-text business letters often name the employee in a single "To:"
// salutation line rather than discrete "Label: value" rows, e.g. "To: Jane
// Doe, Employee ID EMP-1234, Machine Operator, Production department". This
// splits that line on commas and synthesizes the equivalent "Label: value"
// lines (inserted right after the original) so the scan above picks them up
// the same way it would a templated letter — a no-op when no such line
// exists.
const TO_LINE_PATTERN = /^to:\s*(.+)$/i;
const DEPARTMENT_SUFFIX_PATTERN = /^(.+?)\s+department$/i;
const EMPLOYEE_ID_FRAGMENT_PATTERN = /employee\s*id\s*[:\s]*([a-z0-9-]+)/i;

function synthesizeFromSalutationLine(text: string): string {
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.trim().match(TO_LINE_PATTERN);
      if (!match) return [line];

      const parts = match[1]!
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length < 2) return [line];

      const [name, ...rest] = parts;
      const synthesized: string[] = name ? [`Employee name: ${name}`] : [];

      for (const part of rest) {
        const idMatch = part.match(EMPLOYEE_ID_FRAGMENT_PATTERN);
        if (idMatch) {
          synthesized.push(`Employee ID: ${idMatch[1]}`);
          continue;
        }
        const deptMatch = part.match(DEPARTMENT_SUFFIX_PATTERN);
        if (deptMatch) {
          synthesized.push(`Department: ${deptMatch[1]}`);
          continue;
        }
        // The one remaining fact a "To:" line conventionally carries.
        synthesized.push(`Job title: ${part}`);
      }
      return [line, ...synthesized];
    })
    .join("\n");
}

// Formal single-column business letters often address the employee in a
// three-line block right after the date, with no labels at all: their name
// alone on one line, "Employee ID EMP-1234" (no colon) on the next, and
// "Job Title, Department" on the one after. This looks for that bare
// "Employee ID X" line and synthesizes "Label: value" lines from its
// immediate neighbors — a no-op when no such line exists.
const BARE_EMPLOYEE_ID_LINE_PATTERN = /^employee\s*id\s+([a-z0-9][a-z0-9-]*)$/i;

function synthesizeFromAddressBlock(text: string): string {
  const lines = text.split(/\r?\n/);
  const trimmed = lines.map((l) => l.trim());
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const idMatch = trimmed[i]!.match(BARE_EMPLOYEE_ID_LINE_PATTERN);
    if (!idMatch) {
      result.push(lines[i]!);
      continue;
    }

    result.push(lines[i]!, `Employee ID: ${idMatch[1]}`);

    // The name line immediately precedes this one in the block — guarded
    // against already being a "Label: value" line so a template's own
    // "Issued by: ..." line the row before never gets mistaken for it.
    const prev = trimmed[i - 1];
    if (prev && !/[:\-]\s*\S/.test(prev)) {
      result.push(`Employee name: ${prev}`);
    }

    // The following line is conventionally "Job Title, Department".
    const next = trimmed[i + 1];
    if (next?.includes(",") && !/^(dear|re|from|to)\b/i.test(next)) {
      const [title, ...deptParts] = next.split(",");
      const department = deptParts.join(",").trim();
      if (title?.trim()) result.push(`Job title: ${title.trim()}`);
      if (department) result.push(`Department: ${department}`);
    }
  }

  return result.join("\n");
}

// Some letters never put the employee's details on their own dedicated
// line at all: the name only ever appears in the "Dear Name," salutation,
// and the ID/title/department are buried mid-sentence in a narrative
// paragraph (e.g. "...regarding your timekeeping. Employee ID EMP-7089,
// Logistics Coordinator, Logistics department, issued by ..."), or the name
// and ID both appear together in a "Re:"/"To:" line with the ID
// parenthesized, e.g. "Re: Aisha Danjuma (Employee ID EMP-7245), Claims
// Adjuster, Claims Department" or a memo's "TO: Chukwuemeka Ogunleye
// (EMP-7178), Maintenance Technician, Facilities & Engineering" (no
// "Employee ID" text at all, just the bare code in parens). All three are
// searched for anywhere within a line rather than anchored to its start,
// and synthesized as the usual "Label: value" lines — a no-op when none of
// the patterns occur.
const DEAR_NAME_LINE_PATTERN = /^dear\s+([a-z][a-z'.-]*(?:\s+[a-z][a-z'.-]*){0,3}),?\s*$/i;
const GENERIC_SALUTATIONS = new Set(["sir", "madam", "sir/madam", "sir or madam", "team", "all", "colleague", "employee", "staff", "valued employee"]);
const EMBEDDED_ID_TITLE_DEPT_PATTERN = /\bemployee\s*id\s+([a-z0-9][a-z0-9-]*)\s*,\s*([^,]+?)\s*,\s*([^,]+?)\s+department\b/i;
const LABELED_NAME_ID_LINE_PATTERN =
  /^(?:to|re):\s*([a-z][a-z'.-]*(?:\s+[a-z][a-z'.-]*){0,3})\s*\(\s*(?:employee\s*id\s*[:\s]*)?([a-z0-9][a-z0-9-]*)\s*\)\s*,\s*(.+)$/i;

function synthesizeFromNarrativeDetails(text: string): string {
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const trimmed = line.trim();
      const synthesized: string[] = [];

      const dearMatch = trimmed.match(DEAR_NAME_LINE_PATTERN);
      if (dearMatch && !GENERIC_SALUTATIONS.has(dearMatch[1]!.trim().toLowerCase())) {
        synthesized.push(`Employee name: ${dearMatch[1]!.trim()}`);
      }

      const detailsMatch = trimmed.match(EMBEDDED_ID_TITLE_DEPT_PATTERN);
      if (detailsMatch) {
        synthesized.push(
          `Employee ID: ${detailsMatch[1]}`,
          `Job title: ${detailsMatch[2]!.trim()}`,
          `Department: ${detailsMatch[3]!.trim()}`
        );
      }

      const labeledMatch = trimmed.match(LABELED_NAME_ID_LINE_PATTERN);
      if (labeledMatch) {
        synthesized.push(`Employee name: ${labeledMatch[1]!.trim()}`, `Employee ID: ${labeledMatch[2]}`);
        const rest = labeledMatch[3]!;
        const commaIndex = rest.indexOf(",");
        if (commaIndex >= 0) {
          const department = rest.slice(commaIndex + 1).trim();
          const suffixMatch = department.match(DEPARTMENT_SUFFIX_PATTERN);
          synthesized.push(
            `Job title: ${rest.slice(0, commaIndex).trim()}`,
            `Department: ${suffixMatch ? suffixMatch[1] : department}`
          );
        } else {
          synthesized.push(`Job title: ${rest.trim()}`);
        }
      }

      return synthesized.length ? [line, ...synthesized] : [line];
    })
    .join("\n");
}

// Ordered most-specific-first, same rationale as FIELD_LABELS above: a
// dedicated "Date Issued"/"Issue Date" label should always win over the
// generic "Date:" a letter's own header conventionally carries.
const DATE_ISSUED_LABEL_PATTERN =
  /^(date\s*issued|issue\s*date|issued\s*(?:on|date)|date\s*of\s*issue|letter\s*date)\s*[:\-]\s*(.+)$/i;
// A bare "Date:" line is the letter's own header date in most CM templates
// (i.e. the issue date), but it's a much weaker signal than an explicit
// label above — only trusted as a fallback when nothing more specific
// matches anywhere in the document.
const BARE_DATE_LABEL_PATTERN = /^date\s*[:\-]\s*(.+)$/i;

// Separator optional, same reasoning as VALID_UNTIL_LABEL_PATTERN below —
// "Valid for 12 months" is natural prose with no colon, while
// "Validity Period:" conventionally has one; both need to match either way.
const VALID_MONTHS_LABEL_PATTERN =
  /^(validity\s*period|valid(?:ity)?\s*for|valid\s*period|period\s*of\s*validity)\s*[:\-]?\s*(.+)$/i;
// Unlike the label patterns above, this is searched anywhere in the line
// (not anchored to its start) and doesn't require a colon/dash separator —
// "...this warning is valid until 09/15/2026" is at least as common a
// phrasing in CM letters as a dedicated "Valid Until:" line.
const VALID_UNTIL_LABEL_PATTERN =
  /\b(valid\s*(?:until|through|thru)|expiry\s*date|expiration\s*date|date\s*of\s*expiry)\s*[:\-]?\s*(.+)$/i;

// None of the real sample CM letters use a labeled "Validity Period:"
// field at all — every one instead states it as prose describing how long
// the record stays on the employee's file, e.g. "This warning will remain
// active on your file for 6 months.", "...remain on your personnel file
// for a period of twelve (12) months...", "...will stay on your file for
// six months.", "...will fall away after three months of sustained
// improvement." Matched against the whole text rather than line-by-line,
// since \s+ already bridges a mid-sentence line wrap either way, and
// anchored to one of these specific retention verbs so it never matches
// an unrelated "X months" elsewhere in the body (e.g. an improvement
// target like "maintain attendance ... over the next 3 months").
const RETENTION_PERIOD_PATTERN =
  /(?:remain(?:s)?\s+(?:active\s+)?(?:on\s+(?:your\s+)?(?:personnel\s+)?file\s+)?for|stay(?:s)?\s+on\s+(?:your\s+)?file\s+for|fall(?:s)?\s+away\s+after)\s+(?:a\s+period\s+of\s+)?([a-z]+|\d+)\s*(?:\(\s*(\d+)\s*\))?\s*months?\b/i;

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

function wordOrNumeralToNumber(word: string): number | null {
  if (/^\d+$/.test(word)) return Number(word);
  return NUMBER_WORDS[word.toLowerCase()] ?? null;
}

// A number in parens right after the word form (e.g. "twelve (12) months")
// is the more reliable of the two — already numeric, no word-to-number
// lookup needed.
function extractRetentionPeriodMonths(text: string): number | null {
  const match = text.match(RETENTION_PERIOD_PATTERN);
  if (!match) return null;
  if (match[2]) return Number(match[2]);
  return wordOrNumeralToNumber(match[1]!);
}

// Formal letters that skip a "Date:" label entirely still conventionally
// place a bare date on its own line right after the letterhead/address
// block and before the recipient's name — e.g. a line that is nothing but
// "25 May 2026". Scanning only the first several non-blank lines (not the
// whole document) keeps this from ever picking up an unrelated bare date
// mentioned deep in the body.
const HEADING_LINES_FOR_DATE_FALLBACK = 6;
const STANDALONE_DATE_LINE_PATTERN =
  /^(?:\d{4}-\d{1,2}-\d{1,2}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{4})\.?$/i;

function extractPositionalDateFallback(text: string): string | null {
  const headingLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, HEADING_LINES_FOR_DATE_FALLBACK);

  for (const line of headingLines) {
    if (STANDALONE_DATE_LINE_PATTERN.test(line)) return parseDateLoose(line);
  }
  return null;
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Parses the handful of date formats CM letters actually use in practice
 * ("March 3, 2026", "3 March 2026", "2026-03-03", "03/03/2026") into an ISO
 * YYYY-MM-DD string. Deliberately not Date.parse: its format support is
 * inconsistent across engines and it silently guesses on ambiguous
 * DD/MM-vs-MM/DD input the same way this does, without the caller being
 * able to tell whether the parse actually succeeded.
 */
function parseDateLoose(raw: string): string | null {
  const value = raw.trim().replace(/[.,]+$/, "");

  // Anchored only at the start, not the end — callers like
  // VALID_UNTIL_LABEL_PATTERN can hand over an embedded match with trailing
  // sentence text after the date (e.g. "09/15/2026, unless renewed").
  let m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return isoDateOrNull(Number(m[1]), Number(m[2]), Number(m[3]));

  m = value.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const month = MONTH_NAMES.indexOf(m[1]!.toLowerCase());
    if (month >= 0) return isoDateOrNull(Number(m[3]), month + 1, Number(m[2]));
  }

  m = value.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})/);
  if (m) {
    const month = MONTH_NAMES.indexOf(m[2]!.toLowerCase());
    if (month >= 0) return isoDateOrNull(Number(m[3]), month + 1, Number(m[1]));
  }

  // MM/DD/YYYY vs DD/MM/YYYY is inherently ambiguous without a locale; if
  // the first segment can't possibly be a month, it must be the day.
  m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const [month, day] = a > 12 && b <= 12 ? [b, a] : [a, b];
    return isoDateOrNull(Number(m[3]), month, day);
  }

  return null;
}

function isoDateOrNull(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects e.g. "February 30" — the components round-trip through Date
  // wrap into a different day, which Date.UTC accepts silently.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseValidPeriodMonths(raw: string): number | null {
  const value = raw.trim();
  const months = value.match(/(\d+)\s*month/i);
  if (months) return Number(months[1]);
  const years = value.match(/(\d+)\s*year/i);
  if (years) return Number(years[1]) * 12;
  return null;
}

// Whole calendar months between two ISO dates, floored the same way
// computeExpiryDate's addMonths is applied forward — used to back-derive a
// validity period from a "Valid until <date>" label when no explicit
// "X months" figure is given.
function monthsBetweenIsoDates(fromIso: string, toIso: string): number | null {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;

  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return months > 0 ? months : null;
}

/**
 * Scans PDF/DOCX-extracted text for a "Date Issued"/"Validity Period"
 * label, same best-effort "Label: value" heuristic as
 * extractEmployeeCandidateFromText. A "Valid until <date>" label is
 * accepted too and converted to a month count relative to the detected
 * issue date; either field is simply null when nothing matches.
 */
export function extractDocumentDetailsFromText(text: string): ExtractedDocumentDetails {
  let dateIssued: string | null = null;
  let bareDateFallback: string | null = null;
  let validPeriodMonths: number | null = null;
  let validUntil: string | null = null;

  // Some form-style templates drop the colon entirely — a bare "Date
  // issued" cell followed by "1 June 2026" in the next paragraph, same
  // convention as the bare employee-field labels handled elsewhere.
  const preprocessed = mergeBareLabelLines(text);

  for (const rawLine of preprocessed.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (!dateIssued) {
      const m = line.match(DATE_ISSUED_LABEL_PATTERN);
      if (m) dateIssued = parseDateLoose(m[2]!);
    }
    if (!bareDateFallback) {
      const m = line.match(BARE_DATE_LABEL_PATTERN);
      if (m) bareDateFallback = parseDateLoose(m[1]!);
    }
    if (!validPeriodMonths) {
      const m = line.match(VALID_MONTHS_LABEL_PATTERN);
      if (m) validPeriodMonths = parseValidPeriodMonths(m[2]!);
    }
    if (!validUntil) {
      const m = line.match(VALID_UNTIL_LABEL_PATTERN);
      if (m) validUntil = parseDateLoose(m[2]!);
    }
  }

  if (!dateIssued) dateIssued = bareDateFallback;
  if (!dateIssued) dateIssued = extractPositionalDateFallback(text);
  if (!validPeriodMonths && validUntil && dateIssued) {
    validPeriodMonths = monthsBetweenIsoDates(dateIssued, validUntil);
  }
  if (!validPeriodMonths) validPeriodMonths = extractRetentionPeriodMonths(text);

  return { dateIssued, validPeriodMonths };
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
