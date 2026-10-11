import { z } from "zod";
import { verifyQuote } from "@/domain/ai/grounding";
import type { CheckId, CheckResult, DocKind, MissingDoc, Policy, PolicyFacts, PolicyNumbers, RoomTier } from "@/domain/types";
import { applyRules, formatInr, formatLakh, sumInsuredCheck } from "./framework";

/*
 * What the model returns when it reads a policy. Gemini rejects response
 * schemas whose length and count limits multiply into too many states, so
 * this schema carries no maxLength/maxItems; `clean` applies the limits.
 */

const DOC_KINDS = ["policy-schedule", "policy-wording", "summary-sheet", "brochure", "health-card", "premium-receipt", "other"] as const;

const checkItem = z.object({
  status: z.enum(["meets", "partial", "does-not-meet", "not-found"]),
  value: z
    .string()
    .describe("The value in a few words as the policy states it, e.g. '10% for age 61+ at entry' or 'Single private room'. Empty if not found."),
  explanation: z.string().describe("One short plain sentence for a family, no jargon. Never promise cover or approval."),
  quote: z.string().nullable().describe("Exact words copied from the document (one cell or 1-2 sentences). Null if none."),
  page: z.number().nullable().describe("Page number from the [Page N] marker where the quote is"),
});

export const READ_CHECK_KEYS = {
  coPayment: "co-payment",
  roomRent: "room-rent",
  diseaseSubLimits: "disease-sublimits",
  prePostHospitalisation: "pre-post",
  pedWaiting: "ped-waiting",
  dayCare: "day-care",
  restoration: "restoration",
  noClaimBonus: "no-claim-bonus",
  healthCheckup: "health-checkup",
  consumables: "consumables",
  domiciliary: "domiciliary",
  ayush: "ayush",
} as const satisfies Record<string, CheckId>;

const nNum = z.number().nullable();
const nStr = z.string().nullable();

export const readPolicySchema = z.object({
  isHealthInsurancePolicy: z.boolean().describe("False if the files are not a health insurance policy, schedule, wording or brochure"),
  files: z.array(z.object({ fileName: z.string(), kind: z.enum(DOC_KINDS) })).describe("One entry per uploaded file, in order"),
  insurerName: nStr,
  productName: nStr,
  policyNumber: nStr,
  policyType: z.enum(["family-floater", "individual", "group-employer", "senior-citizen", "top-up"]).nullable(),
  sumInsuredInr: nNum.describe(
    "The sum insured of THIS policy as a plain rupee number, only if a schedule or certificate states it. Not the list of plan options.",
  ),
  cumulativeBonusInr: nNum.describe("Cumulative / no-claim bonus amount already earned, as a plain rupee number, if the schedule shows it"),
  policyStart: nStr.describe("YYYY-MM-DD"),
  policyEnd: nStr.describe("YYYY-MM-DD"),
  firstInception: nStr.describe("YYYY-MM-DD date the policy was first bought (continuous cover), if stated"),
  insuredPersons: z.array(z.object({ name: z.string(), age: nNum, relation: nStr })),
  tpaName: nStr,
  helpline: nStr.describe("Claims or cashless helpline number as printed"),
  checks: z.object({
    coPayment: checkItem,
    roomRent: checkItem,
    diseaseSubLimits: checkItem,
    prePostHospitalisation: checkItem,
    pedWaiting: checkItem,
    dayCare: checkItem,
    restoration: checkItem,
    noClaimBonus: checkItem,
    healthCheckup: checkItem,
    consumables: checkItem,
    domiciliary: checkItem,
    ayush: checkItem,
  }),
  numbers: z.object({
    coPayPercent: nNum.describe("General co-payment %, 0 if the wording has no co-payment"),
    coPayMinAge: nNum.describe("Age from which the co-payment applies, if it only applies to older members"),
    roomRentBasis: z.enum(["no-limit", "category", "percent-of-si", "fixed-per-day", "tiered-by-sum-insured"]).nullable(),
    roomRentPercent: nNum,
    roomRentAmountInr: nNum,
    roomCategory: nStr.describe("Room allowed, e.g. 'Single private AC room', if stated as a category"),
    roomRentTiers: z
      .array(
        z.object({
          sumInsuredOptionsInr: z.array(z.number()).describe("Sum insured options this tier applies to, as rupee numbers, e.g. [500000, 750000]"),
          basis: z.enum(["no-limit", "category", "percent-of-si", "fixed-per-day"]),
          percent: nNum,
          amountInr: nNum,
          category: nStr,
          quote: nStr.describe("The table cell exactly as written, e.g. 'Up to 1% of Sum Insured per day'"),
          page: nNum,
        }),
      )
      .describe("When room rent depends on the sum insured, every tier from the table. Empty otherwise."),
    preDays: nNum,
    postDays: nNum,
    initialWaitingDays: nNum,
    pedMonths: nNum,
    specificIllnessMonths: nNum,
    specificIllnesses: z.array(z.string()).describe("Up to 15 named illnesses or procedures in the specific waiting list, short names"),
    maternityCovered: z.boolean().nullable(),
    maternityMonths: nNum,
    maternityLimitInr: nNum,
    consumablesCovered: z.boolean().nullable(),
    subLimits: z
      .array(z.object({ procedure: z.string(), amountInr: nNum, percentOfSi: nNum, per: nStr }))
      .describe("Caps on specific treatments, e.g. cataract per eye"),
  }),
});

export type ReadPolicyOutput = z.infer<typeof readPolicySchema>;

/** Request body: text of each uploaded file, page by page. */
export const readRequestSchema = z.object({
  files: z
    .array(z.object({ name: z.string().max(200), pages: z.array(z.string().max(40_000)).min(1).max(200) }))
    .min(1)
    .max(4),
});
export type ReadRequest = z.infer<typeof readRequestSchema>;

export const MAX_DOCUMENT_CHARS = 300_000;

/** Joins files into one page list with file markers, within the size budget. */
export function combineFiles(files: ReadRequest["files"]): {
  text: string;
  pages: string[];
  refs: { file: string; page: number }[];
  truncated: boolean;
} {
  const pages: string[] = [];
  const refs: { file: string; page: number }[] = [];
  const parts: string[] = [];
  let total = 0;
  let truncated = false;
  outer: for (const f of files) {
    parts.push(`=== File: ${f.name} ===`);
    for (let i = 0; i < f.pages.length; i++) {
      const clean = f.pages[i].replace(/[ \t]+\n/g, "\n").trim();
      if (total + clean.length > MAX_DOCUMENT_CHARS) {
        truncated = true;
        break outer;
      }
      pages.push(clean);
      refs.push({ file: f.name, page: i + 1 });
      parts.push(`[Page ${pages.length}]\n${clean}`);
      total += clean.length;
    }
  }
  return { text: parts.join("\n\n"), pages, refs, truncated };
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const quoteCut = (q: string | null, n: number) => {
  if (!q || q.length <= n) return q;
  const head = q.slice(0, n);
  const sp = head.lastIndexOf(" ");
  return sp > n * 0.6 ? head.slice(0, sp) : head;
};
const isoOrNull = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const posOrNull = (v: number | null) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/** Which documents are still needed, worked out from what the files are. */
export function missingDocs(kinds: DocKind[], facts: Pick<PolicyFacts, "sumInsuredInr">): MissingDoc[] {
  const out: MissingDoc[] = [];
  if (!kinds.includes("policy-wording"))
    out.push({
      kind: "policy-wording",
      title: "Policy wording",
      why: kinds.includes("brochure")
        ? "Brochures can leave out conditions. The policy wording (the long document with numbered clauses) has the limits, waiting periods and exclusions."
        : "The long document with numbered clauses. It has the limits, waiting periods and exclusions we check.",
    });
  if (!kinds.includes("policy-schedule") && !facts.sumInsuredInr)
    out.push({
      kind: "policy-schedule",
      title: "Policy schedule",
      why: "The 1–3 page document with your name and policy number. It tells us your cover amount, who is covered and your policy dates.",
    });
  return out;
}

/**
 * Turns the model's reading into checked results: every quote is matched
 * against the uploaded text, numeric rules are applied, and the cover amount
 * check is added.
 */
export function buildChecks(
  out: ReadPolicyOutput,
  pages: string[],
  hasWording: boolean,
): { checks: CheckResult[]; verified: number; quoted: number } {
  let verified = 0;
  let quoted = 0;
  const checks: CheckResult[] = (Object.keys(READ_CHECK_KEYS) as (keyof typeof READ_CHECK_KEYS)[]).map((key) => {
    const raw = out.checks[key];
    const quote = quoteCut(raw.quote?.trim() || null, 600);
    const m = verifyQuote(quote, pages);
    if (quote) {
      quoted++;
      if (m.verified) verified++;
    }
    let status = raw.status;
    // Without the policy wording, the absence of a restriction proves nothing.
    if (!hasWording && status === "meets" && !m.verified) status = "not-found";
    return {
      id: READ_CHECK_KEYS[key],
      status,
      value: cut(raw.value?.trim() || (status === "not-found" ? "Not found" : ""), 90),
      explanation: cut(raw.explanation?.trim() || "", 260),
      quote,
      page: m.verified ? m.page : posOrNull(raw.page),
      verified: m.verified,
      source: "document" as const,
    };
  });
  return { checks, verified, quoted };
}

export function cleanNumbers(n: ReadPolicyOutput["numbers"]): PolicyNumbers {
  return {
    coPayPercent: posOrNull(n.coPayPercent),
    coPayMinAge: posOrNull(n.coPayMinAge),
    roomRentBasis: n.roomRentBasis,
    roomRentPercent: posOrNull(n.roomRentPercent),
    roomRentAmountInr: posOrNull(n.roomRentAmountInr),
    roomCategory: n.roomCategory ? cut(n.roomCategory, 80) : null,
    roomRentTiers: (n.roomRentTiers ?? []).slice(0, 8).map((t) => ({
      sumInsuredOptionsInr: t.sumInsuredOptionsInr.filter((x) => Number.isFinite(x) && x > 0).slice(0, 12),
      basis: t.basis,
      percent: posOrNull(t.percent),
      amountInr: posOrNull(t.amountInr),
      category: t.category ? cut(t.category, 80) : null,
      quote: quoteCut(t.quote?.trim() || null, 200),
      page: posOrNull(t.page),
    })),
    preDays: posOrNull(n.preDays),
    postDays: posOrNull(n.postDays),
    initialWaitingDays: posOrNull(n.initialWaitingDays),
    pedMonths: posOrNull(n.pedMonths),
    specificIllnessMonths: posOrNull(n.specificIllnessMonths),
    specificIllnesses: n.specificIllnesses.slice(0, 15).map((s) => cut(s, 60)),
    maternityCovered: n.maternityCovered,
    maternityMonths: posOrNull(n.maternityMonths),
    maternityLimitInr: posOrNull(n.maternityLimitInr),
    consumablesCovered: n.consumablesCovered,
    subLimits: n.subLimits.slice(0, 12).map((s) => ({
      procedure: cut(s.procedure, 60),
      amountInr: posOrNull(s.amountInr),
      percentOfSi: posOrNull(s.percentOfSi),
      per: s.per ? cut(s.per, 30) : null,
    })),
  };
}

export function cleanFacts(o: ReadPolicyOutput): PolicyFacts {
  return {
    insurerName: o.insurerName ? cut(o.insurerName, 120) : null,
    productName: o.productName ? cut(o.productName, 120) : null,
    policyNumber: o.policyNumber ? cut(o.policyNumber, 60) : null,
    policyType: o.policyType,
    sumInsuredInr: posOrNull(o.sumInsuredInr) || null,
    cumulativeBonusInr: posOrNull(o.cumulativeBonusInr) || null,
    policyStart: isoOrNull(o.policyStart),
    policyEnd: isoOrNull(o.policyEnd),
    firstInception: isoOrNull(o.firstInception),
    insuredPersons: o.insuredPersons
      .slice(0, 10)
      .map((p) => ({ name: cut(p.name, 80), age: posOrNull(p.age), relation: p.relation ? cut(p.relation, 30) : null })),
    tpaName: o.tpaName ? cut(o.tpaName, 120) : null,
    helpline: o.helpline ? cut(o.helpline, 60) : null,
  };
}

/** What the server returns to the browser after reading. */
export interface ReadResult {
  isHealthInsurancePolicy: boolean;
  files: { name: string; kind: DocKind; pages: number }[];
  facts: PolicyFacts;
  numbers: PolicyNumbers;
  checks: CheckResult[];
  missing: MissingDoc[];
  verified: number;
  quoted: number;
  truncated: boolean;
  model: string;
}

export function toReadResult(out: ReadPolicyOutput, req: ReadRequest, combined: ReturnType<typeof combineFiles>, model: string): ReadResult {
  const files = req.files.map((f, i) => ({
    name: f.name,
    kind: (out.files.find((x) => x.fileName === f.name)?.kind ?? out.files[i]?.kind ?? "other") as DocKind,
    pages: f.pages.length,
  }));
  const kinds = files.map((f) => f.kind);
  const facts = cleanFacts(out);
  const numbers = cleanNumbers(out.numbers);
  const { checks, verified, quoted } = buildChecks(out, combined.pages, kinds.includes("policy-wording"));
  const guarded = kinds.includes("policy-wording") ? subLimitGuard(checks, combined.pages) : checks;
  const filled = coPayFromCheck(numbers, guarded);
  const tiered = applyRoomTier(applyRules(guarded, filled), filled, facts.sumInsuredInr, combined.pages);
  return {
    isHealthInsurancePolicy: out.isHealthInsurancePolicy,
    files,
    facts,
    numbers: tiered.numbers,
    checks: [...tiered.checks, sumInsuredCheck(facts.sumInsuredInr, false, facts.cumulativeBonusInr)],
    missing: missingDocs(kinds, facts),
    verified,
    quoted,
    truncated: combined.truncated,
    model,
  };
}

/**
 * Fills co-payment numbers the model left out but stated in the co-payment
 * check, and notes when the age rule is about the age at entry.
 */
export function coPayFromCheck(n: PolicyNumbers, checks: CheckResult[]): PolicyNumbers {
  const c = checks.find((x) => x.id === "co-payment");
  if (!c || (c.status !== "partial" && c.status !== "does-not-meet")) return n;
  const text = `${c.quote ?? ""} ${c.value}`;
  const pct = n.coPayPercent ?? (Number(text.match(/(\d{1,2})\s*%/)?.[1]) || null);
  const age = n.coPayMinAge ?? (c.status === "partial" ? Number(text.match(/(\d{2})\s*(?:years|yrs|\+)/i)?.[1]) || null : null);
  const onEntry = /entry|entering|time of (?:entry|inception|proposal)|joining/i.test(text);
  return { ...n, coPayPercent: pct, coPayMinAge: age, coPayOnEntryAge: n.coPayOnEntryAge ?? (onEntry || undefined) };
}

const SUBLIMIT_WORD = /sub-?limit/i;
const HAS_AMOUNT = /%|rs\.?\s?[\d,]|₹|lakh/i;
const NOT_A_DISEASE_CAP = /room|ambulance|delivery|maternity|new ?born|health check|check-up|organ donor|home care|assisted reproduction|cumulative bonus/i;

/**
 * The model sometimes reports "no disease sub-limits" while the wording caps a
 * named treatment. If it says "meets" without a quote, look for a sentence
 * that puts a sub-limit with an amount on a treatment, and show that clause.
 */
export function subLimitGuard(checks: CheckResult[], pages: string[]): CheckResult[] {
  const i = checks.findIndex((c) => c.id === "disease-sublimits");
  const c = checks[i];
  if (!c || c.status !== "meets" || c.quote) return checks;
  for (const page of pages) {
    const flat = page.replace(/\s+/g, " ");
    for (const sentence of flat.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
      if (sentence.length < 40 || sentence.length > 320) continue;
      if (!SUBLIMIT_WORD.test(sentence) || !HAS_AMOUNT.test(sentence) || NOT_A_DISEASE_CAP.test(sentence)) continue;
      const m = verifyQuote(sentence, pages);
      if (!m.verified) continue;
      const out = [...checks];
      out[i] = {
        ...c,
        status: "partial",
        value: "Caps on some treatments",
        explanation: "The wording sets sub-limits on some treatments. Read this clause before planning one of them.",
        quote: sentence,
        page: m.page,
        verified: true,
        source: "rule",
      };
      return out;
    }
  }
  return checks;
}

/** The tier of a room-rent table that applies to a sum insured: an exact match, else the nearest option below it. */
export function tierFor(tiers: RoomTier[] | undefined, si: number | null): RoomTier | null {
  if (!tiers?.length || !si) return null;
  const exact = tiers.find((t) => t.sumInsuredOptionsInr.includes(si));
  if (exact) return exact;
  let best: { t: RoomTier; v: number } | null = null;
  for (const t of tiers) for (const v of t.sumInsuredOptionsInr) if (v <= si && (!best || v > best.v)) best = { t, v };
  return best?.t ?? null;
}

/**
 * Room rent often depends on the sum insured. The model copies the whole
 * table; the tier for this policy is picked here from the schedule's sum
 * insured, so the verdict doesn't hinge on the model choosing a column.
 */
export function applyRoomTier(
  checks: CheckResult[],
  numbers: PolicyNumbers,
  si: number | null,
  pages: string[],
): { checks: CheckResult[]; numbers: PolicyNumbers } {
  const tier = tierFor(numbers.roomRentTiers, si);
  if (!tier || !si) return { checks, numbers };
  const n: PolicyNumbers = {
    ...numbers,
    roomRentBasis: tier.basis,
    roomRentPercent: tier.percent,
    roomRentAmountInr: tier.amountInr,
    roomCategory: tier.category ?? numbers.roomCategory,
  };
  const cap = tier.basis === "percent-of-si" && tier.percent ? Math.round((si * tier.percent) / 100) : tier.basis === "fixed-per-day" ? tier.amountInr : null;
  const cat = (tier.category ?? tier.quote ?? "").toLowerCase();
  const status: CheckResult["status"] =
    tier.basis === "no-limit"
      ? "meets"
      : cap
        ? "does-not-meet"
        : /shared|twin|general ward|multi/.test(cat)
          ? "does-not-meet"
          : /single|private|any room|suite/.test(cat)
            ? "meets"
            : "partial";
  const m = verifyQuote(tier.quote, pages);
  const value = cap ? `Up to ${formatInr(cap)} a day` : (tier.category ?? tier.quote ?? "See the room table");
  const explanation = cap
    ? `For your ${formatLakh(si)} cover the room is capped at ${formatInr(cap)} a day. A costlier room can cut other charges in the bill too.`
    : status === "meets"
      ? `For your ${formatLakh(si)} cover the policy allows ${tier.category ?? "this room"}, with no rupee cap.`
      : `For your ${formatLakh(si)} cover the policy allows ${tier.category ?? "a limited room"}.`;
  const out = checks.map((c) =>
    c.id === "room-rent"
      ? { ...c, status, value: value.slice(0, 90), explanation, quote: tier.quote, page: m.verified ? m.page : tier.page, verified: m.verified, source: "rule" as const }
      : c,
  );
  return { checks: out, numbers: n };
}

/** Recomputes checks that depend on answers the user gave. */
export function withAnswers(p: Policy): Policy {
  const si = p.facts.sumInsuredInr ?? p.answers.sumInsuredInr ?? null;
  const tiered = applyRoomTier(p.checks, coPayFromCheck(p.numbers, p.checks), si, p.pages);
  const checks = tiered.checks.filter((c) => c.id !== "sum-insured");
  return {
    ...p,
    numbers: tiered.numbers,
    checks: [...checks, sumInsuredCheck(si, !p.facts.sumInsuredInr && Boolean(p.answers.sumInsuredInr), p.facts.cumulativeBonusInr ?? null)],
    missing: missingDocs(
      p.files.map((f) => f.kind),
      { sumInsuredInr: si },
    ),
  };
}
