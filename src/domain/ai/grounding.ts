/**
 * Checks that text an AI model "quoted" really appears in the source
 * document. Policy PDFs extract with irregular spacing, hyphenation and
 * typographic quotes, so both sides are normalised before comparison.
 */

export function normaliseForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‚′`]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ")
    .replace(/(\w)-\s*\n\s*(\w)/g, "$1$2") // words split across lines
    .replace(/₹\s*/g, "rs ")
    .replace(/\brs\.?\s*/g, "rs ")
    .replace(/[^a-z0-9%'"\s.,:;()/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text: string): string[] {
  return text.split(" ").filter(Boolean);
}

export interface QuoteMatch {
  verified: boolean;
  /** 1-based page where the quote was found, if any. */
  page: number | null;
}

/**
 * Removes running headers and footers (lines that repeat on many pages once
 * digits are ignored), so a clause that continues onto the next page can
 * still be matched across the page break.
 */
export function stripRunningLines(pages: string[]): string[] {
  if (pages.length < 4) return pages;
  const key = (l: string) => l.trim().toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ");
  const counts = new Map<string, number>();
  for (const p of pages) {
    for (const k of new Set(
      p
        .split("\n")
        .map(key)
        .filter((k) => k.length >= 12),
    ))
      counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const threshold = Math.max(3, Math.ceil(pages.length * 0.4));
  return pages.map((p) =>
    p
      .split("\n")
      .filter((l) => (counts.get(key(l)) ?? 0) < threshold)
      .join("\n"),
  );
}

/**
 * A quote is verified when its normalised form is a substring of a page (or
 * of two adjacent pages joined, without running headers and footers), or
 * when at least 85% of its five-word runs occur on one page or across one
 * page break. Very short quotes (under four words) must match exactly.
 */
export function verifyQuote(quote: string | null | undefined, pages: string[]): QuoteMatch {
  if (!quote) return { verified: false, page: null };
  const q = normaliseForMatch(quote).replace(/^[\s.,;:'"]+|[\s.,;:'"]+$/g, "");
  if (!q) return { verified: false, page: null };
  const normPages = stripRunningLines(pages).map(normaliseForMatch);

  for (let i = 0; i < normPages.length; i++) {
    if (normPages[i].includes(q)) return { verified: true, page: i + 1 };
  }
  for (let i = 0; i < normPages.length - 1; i++) {
    if (`${normPages[i]} ${normPages[i + 1]}`.includes(q)) return { verified: true, page: i + 1 };
  }

  const qw = words(q);
  if (qw.length < 4) return { verified: false, page: null };
  const n = Math.min(5, qw.length);
  const grams: string[] = [];
  for (let i = 0; i + n <= qw.length; i++) grams.push(qw.slice(i, i + n).join(" "));
  let best = { ratio: 0, page: -1 };
  const consider = (text: string, idx: number) => {
    const hit = grams.filter((g) => text.includes(g)).length / grams.length;
    if (hit > best.ratio) best = { ratio: hit, page: idx };
  };
  normPages.forEach((p, idx) => consider(p, idx));
  for (let i = 0; i < normPages.length - 1; i++) consider(`${normPages[i]} ${normPages[i + 1]}`, i);
  if (best.ratio >= 0.85) return { verified: true, page: best.page + 1 };
  return { verified: false, page: null };
}
