/**
 * Guards for AI-written text. Prompts already forbid promises about cover or
 * approval; these checks catch slips so the UI can soften or replace them.
 */

const NEGATION = /\b(whether|if|no|not|n't|cannot|can't|can not|no one can|unclear|unknown|doesn't|does not|isn't|is not|unable|never)\b/;

const PROMISE_PATTERNS: RegExp[] = [
  /\bwill (?:definitely |certainly |surely |be fully )?(?:be )?(approved|covered|reimbursed|paid|settled|overturned|accepted)\b/gi,
  /\b(guarantee[sd]?|guaranteed)\b/gi,
  /\b(definitely|certainly|surely) (?:be )?(approved|covered|reimbursed|paid|settled|overturned)\b/gi,
  /\b100% (?:covered|approved|reimbursed)\b/gi,
];

/** Returns the phrases that read as a promise about cover, approval or payment. */
export function findPromises(text: string): string[] {
  const hits: string[] = [];
  for (const re of PROMISE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const before = text.slice(Math.max(0, m.index - 48), m.index).toLowerCase();
      if (!NEGATION.test(before)) hits.push(m[0]);
    }
  }
  return hits;
}

export const DECISION_DISCLAIMER = "Only the insurer or TPA decides cover, approval and payment. InsureWise can't confirm any of these.";
