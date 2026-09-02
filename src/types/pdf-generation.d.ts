// No published type declarations for these — used only server-side in
// lib/pdf.ts to render CM Documents to PDF (see FR-REC-1).
declare module "html-to-pdfmake" {
  function htmlToPdfmake(html: string, options?: { window?: unknown }): unknown;
  export default htmlToPdfmake;
}

declare module "pdfmake" {
  interface PdfDocument {
    getBuffer(): Promise<Buffer>;
  }
  interface PdfMakePrinter {
    setFonts(fonts: unknown): void;
    setLocalAccessPolicy(callback: (filePath: string) => boolean): void;
    setUrlAccessPolicy(callback: (url: string) => boolean): void;
    createPdf(docDefinition: unknown): PdfDocument;
  }
  const printer: PdfMakePrinter;
  export default printer;
}
