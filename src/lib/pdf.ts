import "server-only";
import path from "node:path";
import { JSDOM } from "jsdom";
import htmlToPdfmake from "html-to-pdfmake";
import printer from "pdfmake";

// Built from process.cwd() rather than imported from pdfmake/fonts/Roboto.js
// (which computes its paths from that file's own __dirname): Turbopack's
// dev-server bundling rewrites __dirname for node_modules code to a
// synthetic, nonexistent path (e.g. "C:\ROOT\..."), so pdfmake's own font
// descriptor 404s at runtime. process.cwd() is a plain runtime OS call, not
// something the bundler rewrites — the same reason lib/storage/local.ts
// resolves its storage root the same way instead of via __dirname.
const ROBOTO_DIR = path.join(process.cwd(), "node_modules", "pdfmake", "fonts", "Roboto");
const fonts = {
  Roboto: {
    normal: path.join(ROBOTO_DIR, "Roboto-Regular.ttf"),
    bold: path.join(ROBOTO_DIR, "Roboto-Medium.ttf"),
    italics: path.join(ROBOTO_DIR, "Roboto-Italic.ttf"),
    bolditalics: path.join(ROBOTO_DIR, "Roboto-MediumItalic.ttf"),
  },
};
const ALLOWED_FONT_FILENAMES = new Set(Object.values(fonts.Roboto).map((p) => path.basename(p)));

printer.setFonts(fonts);
// Every PDF this app generates comes from our own bundled Roboto files or
// from CM content the uploader just handed us (no user-supplied file://
// paths or remote URLs ever reach pdfmake's docDefinition), so local access
// is scoped to just those font files and remote fetches are refused
// outright.
printer.setLocalAccessPolicy((filePath: string) => ALLOWED_FONT_FILENAMES.has(path.basename(filePath)));
printer.setUrlAccessPolicy(() => false);

/**
 * Renders an HTML fragment to a PDF buffer via pdfmake's server API — no
 * headless browser or system binary required. Used to convert Word (.docx)
 * uploads so every CM Document with an uploaded file is stored and
 * downloaded as PDF regardless of how it arrived (FR-REC-1).
 */
export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const { window } = new JSDOM("");
  const content = htmlToPdfmake(`<div>${html}</div>`, { window });
  const doc = printer.createPdf({ content, defaultStyle: { font: "Roboto", fontSize: 10 } });
  return doc.getBuffer();
}
