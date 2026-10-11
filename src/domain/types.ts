/** Core models for the InsureWise MVP. Everything lives in the browser (demo). */

export type Relation = "self" | "spouse" | "child" | "parent" | "parent-in-law" | "sibling" | "other";

export interface Member {
  id: string;
  name: string;
  relation: Relation;
  age: number;
}

export type DocKind = "policy-schedule" | "policy-wording" | "summary-sheet" | "brochure" | "health-card" | "premium-receipt" | "other";

export type CheckStatus = "meets" | "partial" | "does-not-meet" | "not-found";

export type CheckGroup = "must" | "good" | "cover";

export type CheckId =
  | "co-payment"
  | "room-rent"
  | "disease-sublimits"
  | "pre-post"
  | "ped-waiting"
  | "day-care"
  | "restoration"
  | "no-claim-bonus"
  | "health-checkup"
  | "consumables"
  | "domiciliary"
  | "ayush"
  | "sum-insured";

export interface CheckResult {
  id: CheckId;
  status: CheckStatus;
  /** Short value as the policy states it, e.g. "10% for age 61+". */
  value: string;
  /** One plain sentence for a family. */
  explanation: string;
  quote: string | null;
  /** 1-based page in the combined document. */
  page: number | null;
  /** The quote was found in the uploaded text. */
  verified: boolean;
  /** Where the status came from. */
  source: "document" | "you" | "rule";
}

export interface SubLimit {
  procedure: string;
  amountInr: number | null;
  percentOfSi: number | null;
  per: string | null;
}

/** One column of a room-rent table that depends on the sum insured. */
export interface RoomTier {
  sumInsuredOptionsInr: number[];
  basis: "no-limit" | "category" | "percent-of-si" | "fixed-per-day";
  percent: number | null;
  amountInr: number | null;
  category: string | null;
  quote: string | null;
  page: number | null;
}

export interface PolicyNumbers {
  coPayPercent: number | null;
  coPayMinAge: number | null;
  /** The co-payment age is the age when the member first joined, not today's age. */
  coPayOnEntryAge?: boolean;
  roomRentBasis: "no-limit" | "category" | "percent-of-si" | "fixed-per-day" | "tiered-by-sum-insured" | null;
  roomRentPercent: number | null;
  roomRentAmountInr: number | null;
  roomCategory: string | null;
  /** Room-rent tiers by sum insured, when the policy has a table. Code picks the tier. */
  roomRentTiers?: RoomTier[];
  preDays: number | null;
  postDays: number | null;
  initialWaitingDays: number | null;
  pedMonths: number | null;
  specificIllnessMonths: number | null;
  specificIllnesses: string[];
  maternityCovered: boolean | null;
  maternityMonths: number | null;
  maternityLimitInr: number | null;
  consumablesCovered: boolean | null;
  subLimits: SubLimit[];
}

export interface PolicyFacts {
  insurerName: string | null;
  productName: string | null;
  policyNumber: string | null;
  policyType: "family-floater" | "individual" | "group-employer" | "senior-citizen" | "top-up" | null;
  sumInsuredInr: number | null;
  /** Cumulative or no-claim bonus already added to the cover, from the schedule. */
  cumulativeBonusInr: number | null;
  policyStart: string | null;
  policyEnd: string | null;
  firstInception: string | null;
  insuredPersons: { name: string; age: number | null; relation: string | null }[];
  tpaName: string | null;
  helpline: string | null;
}

export interface PageRef {
  file: string;
  page: number;
}

export interface MissingDoc {
  kind: "policy-schedule" | "policy-wording";
  title: string;
  why: string;
}

/** A policy after AI reading and InsureWise's checks. */
export interface Policy {
  id: string;
  createdAt: string;
  label: string;
  files: { name: string; kind: DocKind; pages: number }[];
  /** Text of every page, in order across files. Kept for the assistant and quote checks. */
  pages: string[];
  pageRefs: PageRef[];
  facts: PolicyFacts;
  numbers: PolicyNumbers;
  checks: CheckResult[];
  missing: MissingDoc[];
  memberIds: string[];
  /** Answers the user gave for facts the documents didn't establish. */
  answers: { sumInsuredInr?: number; firstInception?: string };
  ai: { live: boolean; model?: string; verified: number; quoted: number; readMs?: number; fallbackReason?: string };
}
