import "server-only";
import { JSDOM } from "jsdom";
import { marked } from "marked";

// Extra CM upload formats beyond PDF/DOCX (see lib/pdf.ts, lib/docx.ts):
// plain text, Markdown, and HTML. Each gets two things — a plain-text
// rendition for the same best-effort "Label: value" metadata scan used
// everywhere else (lib/metadata-extraction.ts), and an HTML rendition so
// lib/pdf.ts's htmlToPdfBuffer can produce the stored PDF rendition
// (FR-REC-1: every CM Document is stored/downloaded as PDF).

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Wraps plain text (e.g. a .txt upload, or RTF stripped to plain text) as simple HTML paragraphs. */
export function plainTextToHtml(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line) || "&nbsp;"}</p>`)
    .join("");
}

// A markdown pipe-table row, e.g. "| **Employee name** | Zainab Yusuf |" —
// used both to recognize a row and, for the 2-cell case, to synthesize a
// "Label: value" line for the metadata scanner.
const TABLE_ROW_PATTERN = /^\|(.*)\|$/;
const TABLE_SEPARATOR_ROW_PATTERN = /^\|[\s:|-]+\|$/;

/**
 * Converts a Markdown pipe-table's 2-column rows (the "Field | Detail"
 * layout every sample CM template uses) into "Label: value" lines, so the
 * same scanner used for PDF/DOCX/HTML text can find them. Non-table lines
 * (headings, paragraphs) pass through unchanged — including the type
 * heading, which the doc-type detector needs to see near the top.
 */
export function markdownTableRowsToLabelValueLines(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!TABLE_ROW_PATTERN.test(trimmed)) return line;
      if (TABLE_SEPARATOR_ROW_PATTERN.test(trimmed)) return "";

      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim().replace(/\*\*/g, "").replace(/^_+|_+$/g, ""));
      if (cells.length === 2 && cells[0]) return `${cells[0]}: ${cells[1]}`;
      return cells.join(" ");
    })
    .join("\n");
}

/** Renders Markdown to HTML for PDF conversion (lib/pdf.ts). */
export function markdownToHtml(raw: string): string {
  return marked.parse(raw, { async: false }) as string;
}

/**
 * Extracts just the visible body markup from an uploaded HTML document, for
 * PDF conversion (lib/pdf.ts). Passing the raw document to htmlToPdfmake
 * would render <style>/<script> text content as if it were body text —
 * this discards <head> entirely along with those tags anywhere else in the
 * body, keeping only what a browser would actually display.
 */
export function extractHtmlBodyMarkup(html: string): string {
  const { window } = new JSDOM(html);
  window.document.querySelectorAll("script, style").forEach((el) => el.remove());
  return window.document.body?.innerHTML ?? html;
}

/**
 * Flattens an HTML document to plain text for the metadata scanner, in
 * source order: table rows (the "meta" table every sample template uses)
 * become "Label: value" lines exactly like the Markdown/DOCX/PDF cases,
 * interleaved with headings/paragraphs/list items in the order they appear
 * — critical so the type heading (usually before the meta table) is still
 * seen within the doc-type detector's opening-lines window.
 */
export function extractHtmlText(html: string): string {
  const { window } = new JSDOM(html);
  const lines: string[] = [];

  window.document.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li, title, tr").forEach((el) => {
    if (el.tagName === "TR") {
      const cells = Array.from(el.querySelectorAll("td, th")).map((c) => (c.textContent ?? "").trim());
      if (cells.length === 2 && cells[0]) {
        lines.push(`${cells[0]}: ${cells[1]}`);
      } else if (cells.some(Boolean)) {
        lines.push(cells.join(" "));
      }
      return;
    }
    const text = (el.textContent ?? "").trim();
    if (text) lines.push(text);
  });

  return lines.join("\n");
}
