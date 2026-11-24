import "server-only";
// Text from an uploaded resume PDF, extracted on the server with unpdf (a
// serverless build of PDF.js). Only the text is kept; the file is discarded.

export const MAX_PDF_BYTES = 5 * 1024 * 1024;

export class PdfError extends Error {}

export async function pdfToText(bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > MAX_PDF_BYTES) throw new PdfError("That PDF is over 5 MB. Upload a smaller file or paste the text.");
  if (bytes.byteLength < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new PdfError("That file isn't a PDF.");
  const { extractText, getDocumentProxy } = await import("unpdf");
  let text: string;
  try {
    const pdf = await getDocumentProxy(bytes);
    if (pdf.numPages > 20) throw new PdfError("That PDF has more than 20 pages; a resume should be one or two.");
    ({ text } = await extractText(pdf, { mergePages: true }));
  } catch (e) {
    if (e instanceof PdfError) throw e;
    throw new PdfError("Couldn't read that PDF. Try pasting the text instead.");
  }
  const clean = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length < 50) throw new PdfError("Couldn't find text in that PDF (it may be a scanned image). Paste the text instead.");
  return clean;
}
