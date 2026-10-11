import type { CheckGroup, CheckId, CheckResult, CheckStatus, Member, Policy, PolicyNumbers } from "@/domain/types";
import { coverStart, waitingFor } from "@/domain/policy/waiting";

/**
 * The policy checklist, based on Ditto's public health insurance checklist
 * (joinditto.in/health-insurance/checklist): seven must-haves and five
 * good-to-haves, plus a headline check that the cover amount is enough.
 */

export interface CheckDef {
  id: CheckId;
  group: CheckGroup;
  /** Plain-language title shown first. */
  title: string;
  /** The insurance term, shown small, for people who know it. */
  term: string;
  /** What good looks like. */
  good: string;
  /** One-line meaning of the term, for "What does this mean?". */
  meaning: string;
  points: number;
  /** Restrictions: a clause must exist for the restriction to apply. */
  restriction?: boolean;
}

export const CHECKS: CheckDef[] = [
  {
    id: "co-payment",
    group: "must",
    title: "You don't share the bill",
    term: "Co-payment",
    good: "No co-payment",
    meaning: "A co-payment means you pay a fixed share (say 10% or 20%) of every claim yourself, even when the claim is approved.",
    points: 10,
    restriction: true,
  },
  {
    id: "room-rent",
    group: "must",
    title: "Any room, no rent cap",
    term: "Room rent limit",
    good: "No cap on room rent",
    meaning:
      "A room rent limit caps the room you can stay in. If you take a costlier room, many other charges are cut in the same proportion, not just the room.",
    points: 10,
    restriction: true,
  },
  {
    id: "disease-sublimits",
    group: "must",
    title: "No caps on specific treatments",
    term: "Disease-wise sub-limits",
    good: "Full cover for every treatment",
    meaning:
      "A sub-limit caps what the policy pays for a particular treatment (for example ₹40,000 for cataract), even if your cover amount is higher.",
    points: 10,
    restriction: true,
  },
  {
    id: "pre-post",
    group: "must",
    title: "Bills before and after admission",
    term: "Pre- and post-hospitalisation",
    good: "At least 30 days before and 90 after (ideal 60 and 180)",
    meaning: "Tests, consultations and medicines for the same illness in the days before admission and after discharge.",
    points: 10,
  },
  {
    id: "ped-waiting",
    group: "must",
    title: "Existing illnesses covered soon",
    term: "Pre-existing disease (PED) waiting period",
    good: "3 years or less (shorter is better)",
    meaning: "Illnesses you already had when you bought the policy (like diabetes or BP) are covered only after this waiting period.",
    points: 10,
  },
  {
    id: "day-care",
    group: "must",
    title: "Short procedures covered",
    term: "Day care treatments",
    good: "Covered",
    meaning: "Procedures that need less than 24 hours in hospital, like dialysis, chemotherapy or cataract surgery.",
    points: 10,
  },
  {
    id: "restoration",
    group: "must",
    title: "Cover refills after a claim",
    term: "Restoration benefit",
    good: "Restored after every claim (at least once a year)",
    meaning: "If a claim uses up your cover, the policy tops it back up for later claims in the same year.",
    points: 10,
  },
  {
    id: "no-claim-bonus",
    group: "good",
    title: "Extra cover for claim-free years",
    term: "No-claim bonus",
    good: "Offered",
    meaning: "Your cover amount grows each year you don't make a claim.",
    points: 4,
  },
  {
    id: "health-checkup",
    group: "good",
    title: "Free yearly health check-up",
    term: "Annual health check-up",
    good: "Offered",
    meaning: "The policy pays for a routine health check-up every year.",
    points: 4,
  },
  {
    id: "consumables",
    group: "good",
    title: "Gloves, masks and kits paid",
    term: "Consumables cover",
    good: "Covered",
    meaning: "Items like gloves, syringes and admission kits. Without this cover they can be 5–10% of a hospital bill, paid by you.",
    points: 4,
  },
  {
    id: "domiciliary",
    group: "good",
    title: "Treatment at home",
    term: "Domiciliary hospitalisation",
    good: "Covered",
    meaning: "Treatment at home when a hospital bed isn't available or the patient can't be moved.",
    points: 4,
  },
  {
    id: "ayush",
    group: "good",
    title: "Ayurveda and other systems",
    term: "AYUSH treatment",
    good: "Covered",
    meaning: "In-patient treatment under Ayurveda, Yoga, Unani, Siddha or Homeopathy.",
    points: 4,
  },
  {
    id: "sum-insured",
    group: "cover",
    title: "Enough cover amount",
    term: "Sum insured",
    good: "₹10 lakh or more",
    meaning: "The most the policy pays in a year. One big surgery in a city hospital can cost ₹3–6 lakh.",
    points: 10,
  },
];

export const CHECK_BY_ID: Record<CheckId, CheckDef> = Object.fromEntries(CHECKS.map((c) => [c.id, c])) as Record<CheckId, CheckDef>;

const FACTOR: Record<CheckStatus, number> = { meets: 1, partial: 0.5, "does-not-meet": 0, "not-found": 0 };

export type ScoreLabel = "Excellent" | "Good" | "Fair" | "Needs attention";

export interface Verdict {
  score: number;
  label: ScoreLabel;
  mustMet: number;
  mustTotal: number;
  goodMet: number;
  goodTotal: number;
  redFlags: CheckResult[];
  watchOuts: CheckResult[];
  notFound: CheckResult[];
}

export function labelFor(score: number): ScoreLabel {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 45) return "Fair";
  return "Needs attention";
}

/**
 * Score out of 100: must-haves 70, good-to-haves 20, cover amount 10.
 * Partly meets earns half. Anything not found in the documents earns
 * nothing: the score reflects what the documents confirm.
 */
export function verdictFor(checks: CheckResult[]): Verdict {
  let score = 0;
  for (const c of checks) score += CHECK_BY_ID[c.id].points * FACTOR[c.status];
  const must = checks.filter((c) => CHECK_BY_ID[c.id].group === "must");
  const good = checks.filter((c) => CHECK_BY_ID[c.id].group === "good");
  const rounded = Math.round(score);
  return {
    score: rounded,
    label: labelFor(rounded),
    mustMet: must.filter((c) => c.status === "meets").length,
    mustTotal: must.length,
    goodMet: good.filter((c) => c.status === "meets").length,
    goodTotal: good.length,
    redFlags: must.filter((c) => c.status === "does-not-meet"),
    watchOuts: checks.filter((c) => c.status === "partial"),
    notFound: checks.filter((c) => c.status === "not-found"),
  };
}

/** Sum insured check from the documents or the user's answer. A cumulative bonus already earned counts towards the cover. */
export function sumInsuredCheck(si: number | null, fromUser: boolean, bonus: number | null = null): CheckResult {
  const base = { id: "sum-insured" as const, quote: null, page: null, verified: false, source: fromUser ? ("you" as const) : ("rule" as const) };
  if (!si) return { ...base, status: "not-found", value: "Not found", explanation: "Your sum insured isn't in the documents you uploaded." };
  const total = si + (bonus ?? 0);
  const value = bonus ? `${formatLakh(si)} + ${formatLakh(bonus)} bonus` : formatLakh(si);
  const lakh = formatLakh(total);
  if (total >= 1_000_000) return { ...base, status: "meets", value, explanation: `${lakh} a year is a healthy cover amount for most families.` };
  if (total >= 500_000)
    return {
      ...base,
      status: "partial",
      value,
      explanation: `${lakh} a year can run out with one big surgery in a city hospital. A super top-up is a low-cost way to add more.`,
    };
  return {
    ...base,
    status: "does-not-meet",
    value,
    explanation: `${lakh} a year is low for today's hospital costs. A single admission can use it up.`,
  };
}

/** Sum insured plus any bonus already earned, for headline display. */
export function coverText(policy: Policy): string | null {
  const si = policy.facts.sumInsuredInr ?? policy.answers.sumInsuredInr ?? null;
  if (!si) return null;
  const bonus = policy.facts.cumulativeBonusInr ?? 0;
  return bonus > 0 ? `${formatLakh(si + bonus)} cover with bonus` : `${formatLakh(si)} cover`;
}

/** "LOTUS HEALTH AND ALLIED INSURANCE COMPANY LIMITED" → "Lotus Health and Allied Insurance Company Limited". */
export function tidyName(name: string): string {
  if (name !== name.toUpperCase()) return name.replace(/ (And|Of|The|For|In) /g, (m) => m.toLowerCase());
  const small = new Set(["and", "of", "the", "for", "in"]);
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.replace(/^[a-z]/, (c) => c.toUpperCase())))
    .join(" ");
}

export function formatLakh(inr: number): string {
  if (inr >= 10_000_000) return `₹${trim(inr / 10_000_000)} crore`;
  if (inr >= 100_000) return `₹${trim(inr / 100_000)} lakh`;
  return `₹${inr.toLocaleString("en-IN")}`;
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

/**
 * Applies clear numeric rules on top of the AI's reading, so the result
 * doesn't depend on the model's judgement where the numbers settle it.
 */
export function applyRules(checks: CheckResult[], n: PolicyNumbers): CheckResult[] {
  return checks.map((c) => {
    switch (c.id) {
      case "co-payment":
        if (n.coPayPercent && n.coPayPercent > 0) {
          const status: CheckStatus = n.coPayMinAge ? "partial" : "does-not-meet";
          return { ...c, status, value: c.value || `${n.coPayPercent}%${n.coPayMinAge ? ` from age ${n.coPayMinAge}` : ""}` };
        }
        return c;
      case "pre-post":
        if (n.preDays != null && n.postDays != null) {
          const status: CheckStatus = n.preDays >= 30 && n.postDays >= 90 ? "meets" : "partial";
          return { ...c, status, value: `${n.preDays} days before, ${n.postDays} after` };
        }
        return c;
      case "ped-waiting":
        if (n.pedMonths != null) {
          const status: CheckStatus = n.pedMonths <= 24 ? "meets" : n.pedMonths <= 36 ? "partial" : "does-not-meet";
          return { ...c, status, value: c.value || `${n.pedMonths} months` };
        }
        return c;
      case "consumables":
        if (n.consumablesCovered === true && c.status !== "meets") return { ...c, status: "meets" };
        return c;
      case "disease-sublimits": {
        // Caps the model listed on specific treatments outweigh a "no caps" reading.
        const caps = n.subLimits.filter((x) => !EXTRA_BENEFIT.test(x.procedure));
        if (!caps.length || c.status === "does-not-meet" || c.status === "partial") return c;
        const status: CheckStatus = caps.some((x) => COMMON_SURGERY.test(x.procedure)) ? "does-not-meet" : "partial";
        const names = caps.slice(0, 3).map((x) => x.procedure).join(", ");
        return {
          ...c,
          status,
          value: `Caps on ${names}${caps.length > 3 ? " and more" : ""}`.slice(0, 90),
          explanation: "The policy limits what it pays for these treatments, even when your cover amount is higher.",
          source: "rule",
        };
      }
      case "room-rent":
        if (n.roomRentBasis === "no-limit" && c.status === "not-found") return { ...c, status: "meets" };
        if ((n.roomRentBasis === "percent-of-si" || n.roomRentBasis === "fixed-per-day") && c.status === "meets")
          return { ...c, status: "does-not-meet" };
        return c;
      default:
        return c;
    }
  });
}

/** Limits on extra benefits, which aren't disease sub-limits. */
const EXTRA_BENEFIT = /ambulance|home care|domiciliary|delivery|maternity|new ?born|assisted reproduction|\bart\b|ivf|health check|check-up|organ donor|room|attendant|second opinion/i;
/** Common planned surgeries: a cap on any of these is a red flag. */
const COMMON_SURGERY = /cataract|joint|knee|hip|hernia|hysterectomy|piles|ha?emorrhoid|gall ?bladder|calculi|kidney stone|prostat|sinus|tonsil|varicose|angioplasty|bypass|cardiac/i;

/**
 * Co-payment that applies to a member, if any. When the policy ties it to the
 * age at entry, the entry age is worked back from when cover first started
 * (rounded up, so a borderline case still shows the co-payment).
 */
export function coPayFor(n: PolicyNumbers, member: Member, firstBought?: string | null, todayIso?: string): number {
  if (!n.coPayPercent) return 0;
  let age = member.age;
  if (n.coPayOnEntryAge && firstBought) {
    const today = Date.parse(`${todayIso ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    const years = (today - Date.parse(`${firstBought}T00:00:00Z`)) / (365.25 * 86_400_000);
    if (years > 0) age = Math.max(0, Math.ceil(member.age - years));
  }
  if (n.coPayMinAge && age < n.coPayMinAge) return 0;
  return n.coPayPercent;
}

export interface NextStep {
  id: string;
  title: string;
  detail: string;
  tone: "danger" | "warning" | "info";
}

/** The few actions worth taking after reading the verdict. Never product advice. */
export function nextStepsFor(policy: Policy, members: Member[], todayIso?: string): NextStep[] {
  const steps: NextStep[] = [];
  const by = (id: CheckId) => policy.checks.find((c) => c.id === id);
  const n = policy.numbers;
  for (const m of policy.missing) steps.push({ id: `missing-${m.kind}`, title: `Add your ${m.title.toLowerCase()}`, detail: m.why, tone: "warning" });

  const room = by("room-rent");
  if (room && (room.status === "does-not-meet" || room.status === "partial")) {
    const cap = roomCapPerDay(policy);
    steps.push({
      id: "room",
      title: cap ? `Keep the room within ${formatInr(cap)} a day` : "Check your room limit before admission",
      detail: "A costlier room can cut many other charges in your bill by the same proportion. Ask the hospital for a room within your limit.",
      tone: "danger",
    });
  }
  const copay = by("co-payment");
  const affected = members.filter((m) => coPayFor(n, m, coverStart(policy), todayIso) > 0);
  // An age-linked co-payment only matters if someone covered has reached that age.
  if (copay && copay.status !== "meets" && copay.status !== "not-found" && n.coPayPercent && (affected.length || !n.coPayMinAge)) {
    steps.push({
      id: "copay",
      title: affected.length
        ? `${affected.map((m) => m.name.split(" ")[0]).join(", ")} will pay ${n.coPayPercent}% of each claim`
        : `${n.coPayPercent}% of each claim is yours to pay`,
      detail: "Keep this in mind when you plan a treatment. Ask an advisor if a plan without co-payment suits you better at renewal.",
      tone: "warning",
    });
  }
  const si = by("sum-insured");
  if (si && (si.status === "partial" || si.status === "does-not-meet"))
    steps.push({
      id: "si",
      title: "Your cover amount may run short",
      detail: "A super top-up adds a large cover amount for a small premium. Worth asking about at renewal.",
      tone: "warning",
    });
  const cons = by("consumables");
  if (cons && cons.status !== "meets")
    steps.push({
      id: "consumables",
      title: "Budget for consumables",
      detail: "Gloves, masks and kits are usually 5–10% of a hospital bill. Your documents don't show this as covered.",
      tone: "info",
    });
  const ped = by("ped-waiting");
  // Only worth flagging while the pre-existing illness wait is still running (or its end date is unknown).
  const pedWait = waitingFor(policy, todayIso).find((w) => w.kind === "ped");
  if (ped && ped.status !== "meets" && ped.status !== "not-found" && !pedWait?.done)
    steps.push({
      id: "ped",
      title: "Know when existing illnesses get covered",
      detail: "See the waiting-period countdown on each member's card.",
      tone: "info",
    });
  return steps.slice(0, 4);
}

/** Daily room cap in rupees when the documents establish one. */
export function roomCapPerDay(policy: Policy): number | null {
  const n = policy.numbers;
  const si = policy.facts.sumInsuredInr ?? policy.answers.sumInsuredInr ?? null;
  if (n.roomRentBasis === "fixed-per-day" && n.roomRentAmountInr) return n.roomRentAmountInr;
  if (n.roomRentBasis === "percent-of-si" && n.roomRentPercent && si) return Math.round((si * n.roomRentPercent) / 100);
  return null;
}

export function formatInr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
