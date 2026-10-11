/**
 * Client-side text extraction for policy files. PDFs are parsed in the
 * browser with pdf.js (main-thread worker, so it works the same in every
 * bundler); plain-text files are split into pseudo-pages. Nothing here sends
 * data anywhere.
 */

export interface ExtractedText {
  pages: string[];
  pageCount: number;
  chars: number;
  kind: "pdf" | "text";
}

export class TextExtractionError extends Error {
  constructor(
    message: string,
    public code: "unsupported" | "encrypted" | "unreadable" | "no-text",
  ) {
    super(message);
    this.name = "TextExtractionError";
  }
}

const MAX_PAGES = 200;

function splitText(text: string): string[] {
  const byFormFeed = text
    .split("\f")
    .map((p) => p.trim())
    .filter(Boolean);
  if (byFormFeed.length > 1) return byFormFeed;
  const pages: string[] = [];
  let rest = text.trim();
  while (rest.length > 3_500) {
    const cut = rest.lastIndexOf("\n", 3_500);
    const at = cut > 1_500 ? cut : 3_500;
    pages.push(rest.slice(0, at).trim());
    rest = rest.slice(at);
  }
  if (rest.trim()) pages.push(rest.trim());
  return pages;
}

async function extractPdf(data: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  // Load the worker code on the main thread; pdf.js then skips creating a Worker.
  await import("pdfjs-dist/build/pdf.worker.min.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(data), disableFontFace: true, useSystemFonts: false });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    const name = (e as Error)?.name ?? "";
    if (name === "PasswordException")
      throw new TextExtractionError("This PDF is password-protected. Remove the password and try again.", "encrypted");
    throw new TextExtractionError("This PDF couldn't be opened. It may be damaged.", "unreadable");
  }
  const pages: string[] = [];
  const count = Math.min(doc.numPages, MAX_PAGES);
  for (let i = 1; i <= count; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if ("str" in item) text += item.str + (item.hasEOL ? "\n" : "");
    }
    pages.push(text.replace(/[ \t]+\n/g, "\n").trim());
    page.cleanup();
  }
  await task.destroy();
  return pages;
}

export async function extractPolicyText(file: File): Promise<ExtractedText> {
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  const isText = file.type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md");
  if (!isPdf && !isText) throw new TextExtractionError("Choose a PDF or a .txt file.", "unsupported");
  const pages = isPdf ? await extractPdf(await file.arrayBuffer()) : splitText(await file.text());
  const chars = pages.reduce((a, p) => a + p.length, 0);
  if (chars < 200) {
    throw new TextExtractionError(
      isPdf
        ? "This PDF has almost no selectable text, so it is probably a scanned image. Try a text-based PDF, enter the details by hand, or use the sample policy."
        : "This file has almost no text.",
      "no-text",
    );
  }
  return { pages, pageCount: pages.length, chars, kind: isPdf ? "pdf" : "text" };
}
