import "server-only";
import { Tokenize } from "rtf-stream-parser";

// rtf-stream-parser's high-level de-encapsulation API only understands RTF
// that itself wraps plain text or HTML (the Outlook/MAPI convention it was
// built for) — it rejects a letter authored directly as RTF, which is what
// every CM template here is. So this consumes its low-level Tokenize stream
// directly and does the (much simpler) job of stripping formatting down to
// plain text: skip non-content destination groups (font/color tables,
// document info, etc.), turn \par/\line/\row into newlines, and pass
// through everything else.

const IGNORED_DESTINATIONS = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "info",
  "generator",
  "pict",
  "nonshppict",
  "object",
  "objdata",
  "footnote",
  "header",
  "headerl",
  "headerr",
  "headerf",
  "footer",
  "footerl",
  "footerr",
  "footerf",
  "listtable",
  "listoverridetable",
  "revtbl",
  "themedata",
  "colorschememapping",
  "datastore",
  "fldinst",
  "xmlnstbl",
  "rxml",
  "panose",
  "wgrffmtfilter",
]);

const NEWLINE_WORDS = new Set(["par", "line", "row", "sect", "page"]);

// Tokenize's numeric token types (see rtf-stream-parser's README — no
// exported constants for these, just documented magic numbers).
const GROUP_START = 0;
const GROUP_END = 1;
const CONTROL = 2;
const TEXT = 3;

interface RtfToken {
  type: number;
  word?: string;
  param?: number;
  data?: Buffer;
}

export function extractRtfText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const tokenizer = new Tokenize();
    let output = "";
    // One entry per open group; true if this group (or an ancestor) is an
    // ignored destination whose content should be dropped.
    const ignoreStack: boolean[] = [false];
    let pendingStar = false; // saw a lone \* — the RTF spec's own "skip this
    // destination if you don't understand it" marker, so the very next
    // control word's group is ignored regardless of whether we recognize it.

    function ignored(): boolean {
      return ignoreStack[ignoreStack.length - 1] ?? false;
    }

    tokenizer.on("data", (token: RtfToken) => {
      switch (token.type) {
        case GROUP_START:
          ignoreStack.push(ignored());
          pendingStar = false;
          break;
        case GROUP_END:
          ignoreStack.pop();
          break;
        case CONTROL: {
          if (token.word === "*") {
            pendingStar = true;
            break;
          }
          if (pendingStar || (token.word && IGNORED_DESTINATIONS.has(token.word))) {
            ignoreStack[ignoreStack.length - 1] = true;
          }
          pendingStar = false;
          if (!ignored() && token.word) {
            if (NEWLINE_WORDS.has(token.word)) output += "\n";
            else if (token.word === "tab") output += "\t";
            else if (token.word === "u" && typeof token.param === "number") {
              output += String.fromCodePoint(token.param);
            }
          }
          break;
        }
        case TEXT:
          if (!ignored() && token.data) output += token.data.toString("latin1");
          break;
      }
    });

    tokenizer.on("error", reject);
    tokenizer.on("end", () => resolve(output));
    tokenizer.end(buffer);
  });
}
