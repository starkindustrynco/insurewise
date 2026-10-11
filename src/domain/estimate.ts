import type { Member, Policy } from "@/domain/types";
import { coPayFor, roomCapPerDay } from "@/domain/policy/framework";
import { coverStart, formatDate, waitingFor } from "@/domain/policy/waiting";

/**
 * "What will I pay?" Typical costs are illustrative ranges for private
 * hospitals in large Indian cities; a hospital's own estimate replaces them.
 * The calculation follows the policy's own rules: waiting periods, room rent
 * cap with proportionate deduction, sub-limits, consumables, co-payment and
 * the cover amount.
 */

export interface Treatment {
  id: string;
  label: string;
  low: number;
  high: number;
  days: number;
  waiting: "specific" | "maternity" | "none";
  keywords: string[];
}

export const TREATMENTS: Treatment[] = [
  {
    id: "knee",
    label: "Knee replacement (one knee)",
    low: 250000,
    high: 450000,
    days: 4,
    waiting: "specific",
    keywords: ["knee", "joint replacement", "arthroplasty", "joint"],
  },
  {
    id: "hip",
    label: "Hip replacement",
    low: 300000,
    high: 500000,
    days: 5,
    waiting: "specific",
    keywords: ["hip", "joint replacement", "arthroplasty", "joint"],
  },
  { id: "cataract", label: "Cataract surgery (one eye)", low: 30000, high: 80000, days: 0, waiting: "specific", keywords: ["cataract", "lens"] },
  {
    id: "angioplasty",
    label: "Angioplasty (one stent)",
    low: 200000,
    high: 400000,
    days: 3,
    waiting: "none",
    keywords: ["angioplasty", "ptca", "cardiac", "heart"],
  },
  {
    id: "bypass",
    label: "Heart bypass surgery",
    low: 300000,
    high: 600000,
    days: 7,
    waiting: "none",
    keywords: ["bypass", "cabg", "cardiac", "heart"],
  },
  {
    id: "normal-delivery",
    label: "Normal delivery",
    low: 40000,
    high: 100000,
    days: 2,
    waiting: "maternity",
    keywords: ["maternity", "delivery", "childbirth"],
  },
  {
    id: "c-section",
    label: "C-section delivery",
    low: 80000,
    high: 200000,
    days: 4,
    waiting: "maternity",
    keywords: ["maternity", "caesarean", "c-section", "delivery"],
  },
  {
    id: "gallbladder",
    label: "Gallbladder stone removal",
    low: 80000,
    high: 180000,
    days: 2,
    waiting: "specific",
    keywords: ["gallbladder", "gall bladder", "cholecyst", "gall stone"],
  },
  { id: "hernia", label: "Hernia repair", low: 70000, high: 150000, days: 2, waiting: "specific", keywords: ["hernia"] },
  {
    id: "kidney-stone",
    label: "Kidney stone removal",
    low: 60000,
    high: 150000,
    days: 2,
    waiting: "specific",
    keywords: ["kidney stone", "calculi", "urolithiasis", "renal stone", "stone"],
  },
  { id: "appendix", label: "Appendix removal", low: 80000, high: 150000, days: 2, waiting: "none", keywords: ["appendix", "appendic"] },
  { id: "dengue", label: "Dengue or fever admission", low: 30000, high: 100000, days: 4, waiting: "none", keywords: ["dengue", "fever"] },
];

export const ROOMS = [
  { id: "general", label: "General ward", perDay: 2000 },
  { id: "twin", label: "Twin sharing", perDay: 4000 },
  { id: "single", label: "Single private", perDay: 7000 },
  { id: "deluxe", label: "Deluxe", perDay: 12000 },
] as const;
export type RoomId = (typeof ROOMS)[number]["id"];

export interface EstimateLine {
  label: string;
  low: number;
  high: number;
  note: string;
}

export interface PolicyEstimate {
  policyId: string;
  label: string;
  /** What the family may pay. */
  low: number;
  high: number;
  /** What the policy may pay. */
  paysLow: number;
  paysHigh: number;
  lines: EstimateLine[];
  warnings: string[];
  /** Set when the policy says this isn't payable yet, or the documents don't show cover. */
  blocked: string | null;
}

/** Share of the non-room bill that moves with the room category (doctor visits, nursing, OT). */
const ASSOCIATED_SHARE = 0.5;
const CONSUMABLES = { low: 0.05, high: 0.1 };

function matches(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k));
}

function one(policy: Policy, member: Member, t: Treatment, bill: number, roomPerDay: number, days: number) {
  const lines: EstimateLine[] = [];
  const warnings: string[] = [];
  const n = policy.numbers;
  let family = 0;
  let payable = bill;
  const add = (label: string, amount: number, note: string) => {
    if (amount <= 0) return;
    family += amount;
    payable -= amount;
    lines.push({ label, low: amount, high: amount, note });
  };

  // Room rent cap and proportionate deduction.
  const cap = roomCapPerDay(policy);
  if (cap && days > 0 && roomPerDay > cap) {
    const roomExtra = (roomPerDay - cap) * days;
    const rest = Math.max(0, bill - roomPerDay * days);
    const proportional = rest * ASSOCIATED_SHARE * (1 - cap / roomPerDay);
    add("Room above your limit", roomExtra, `Your policy pays up to ₹${cap.toLocaleString("en-IN")} a day for the room.`);
    add("Cut on other charges", proportional, "When the room costs more than the limit, doctor and nursing charges are paid in the same proportion.");
  } else if (!cap && (n.roomRentBasis === "category" || n.roomRentBasis === "tiered-by-sum-insured") && roomPerDay >= 10000) {
    warnings.push(`Your policy allows ${n.roomCategory ?? "a set room category"}. A costlier room may reduce what is paid.`);
  }

  // Consumables.
  if (n.consumablesCovered !== true) {
    const c = bill * CONSUMABLES.low;
    add("Gloves, masks and kits", c, "Usually 5–10% of a bill when consumables aren't covered.");
  }

  // Sub-limit for this treatment.
  const sub = n.subLimits.find((s) => matches(s.procedure, t.keywords));
  const si = policy.facts.sumInsuredInr ?? policy.answers.sumInsuredInr ?? null;
  const subCap = sub ? (sub.amountInr ?? (sub.percentOfSi && si ? (si * sub.percentOfSi) / 100 : null)) : null;
  if (subCap && payable > subCap)
    add(
      `${sub!.procedure} limit`,
      payable - subCap,
      `Your policy caps this at ₹${Math.round(subCap).toLocaleString("en-IN")}${sub!.per ? ` per ${sub!.per}` : ""}.`,
    );

  // Co-payment.
  const cp = coPayFor(n, member, coverStart(policy));
  if (cp) add(`${cp}% co-payment`, (payable * cp) / 100, `${member.name.split(" ")[0]} pays ${cp}% of each claim.`);

  // Cover amount.
  // A bonus already earned adds to what the policy can pay this year.
  const cover = si ? si + (policy.facts.cumulativeBonusInr ?? 0) : null;
  if (cover && payable > cover) add("Above your cover amount", payable - cover, "The policy pays up to the sum insured (plus any bonus) for the year.");
  if (!si) warnings.push("Your cover amount isn't known, so we couldn't check if it's enough.");

  return { family, payable, lines, warnings };
}

function blockedReason(policy: Policy, t: Treatment, onDate: string): { reason: string | null; warning: string | null } {
  const n = policy.numbers;
  const waits = waitingFor(policy, onDate);
  if (t.waiting === "maternity") {
    if (n.maternityCovered === false) return { reason: "Your policy doesn't cover maternity.", warning: null };
    if (n.maternityCovered !== true)
      return { reason: "Maternity cover isn't found in your documents. Ask your insurer before planning.", warning: null };
    const w = waits.find((x) => x.kind === "maternity");
    if (w && w.endsOn && !w.done) return { reason: `Maternity is in a waiting period until ${formatDate(w.endsOn)}.`, warning: null };
  }
  if (t.waiting === "specific") {
    const listed = n.specificIllnesses.some((s) => matches(s, t.keywords));
    const w = waits.find((x) => x.kind === "specific");
    if (w && !w.done) {
      if (listed && w.endsOn) return { reason: `This treatment is on your policy's waiting list until ${formatDate(w.endsOn)}.`, warning: null };
      if (listed)
        return { reason: null, warning: "This treatment is on your policy's waiting list. Add your policy start date to check if it has ended." };
      if (!n.specificIllnesses.length)
        return { reason: null, warning: "Treatments like this are often on a 1–3 year waiting list. Check your policy's list." };
    }
  }
  const initial = waits.find((x) => x.kind === "initial");
  if (initial && initial.endsOn && !initial.done)
    return { reason: `New illnesses are covered after ${formatDate(initial.endsOn)} (accidents are covered now).`, warning: null };
  return { reason: null, warning: null };
}

export function estimateFor(
  policy: Policy,
  member: Member,
  t: Treatment,
  opts: { roomPerDay: number; days?: number; bill?: number | null; onDate?: string },
): PolicyEstimate {
  const days = opts.days ?? t.days;
  const lowBill = opts.bill ?? t.low;
  const highBill = opts.bill ?? t.high;
  const onDate = opts.onDate ?? new Date().toISOString().slice(0, 10);
  const block = blockedReason(policy, t, onDate);
  if (block.reason)
    return {
      policyId: policy.id,
      label: policy.label,
      low: lowBill,
      high: highBill,
      paysLow: 0,
      paysHigh: 0,
      lines: [{ label: "Full bill", low: lowBill, high: highBill, note: block.reason }],
      warnings: [],
      blocked: block.reason,
    };
  const a = one(policy, member, t, lowBill, opts.roomPerDay, days);
  const b = one(policy, member, t, highBill, opts.roomPerDay, days);
  // Consumables: 5% at the low end, 10% at the high end.
  const consHigh = policy.numbers.consumablesCovered !== true ? highBill * (CONSUMABLES.high - CONSUMABLES.low) : 0;
  const byLabel = new Map<string, EstimateLine>();
  for (const l of a.lines) byLabel.set(l.label, { ...l, high: 0 });
  for (const l of b.lines) byLabel.set(l.label, { ...(byLabel.get(l.label) ?? { ...l, low: 0 }), high: l.high });
  const r50 = (x: number) => Math.round(x / 50) * 50;
  const lines = [...byLabel.values()].map((l) => ({
    ...l,
    low: r50(l.low),
    high: r50(l.high + (l.label === "Gloves, masks and kits" ? consHigh : 0)),
  }));
  return {
    policyId: policy.id,
    label: policy.label,
    low: r50(a.family),
    high: r50(b.family + consHigh),
    paysLow: r50(Math.max(0, a.payable)),
    paysHigh: r50(Math.max(0, b.payable - consHigh)),
    lines,
    warnings: [...new Set([...(block.warning ? [block.warning] : []), ...a.warnings])],
    blocked: null,
  };
}

/** The policy where the family is likely to pay least, among those that can pay at all. */
export function bestOf(results: PolicyEstimate[]): PolicyEstimate | null {
  const ok = results.filter((r) => !r.blocked);
  if (!ok.length) return null;
  return [...ok].sort((x, y) => x.high - y.high || x.low - y.low)[0];
}
