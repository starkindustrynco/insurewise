import type { ReadResult } from "@/domain/policy/read";
import { applyRules, sumInsuredCheck } from "@/domain/policy/framework";
import { missingDocs } from "@/domain/policy/read";
import type { CheckResult } from "@/domain/types";

/**
 * The bundled fictional sample policy (public/samples/insurewise-sample-policy.pdf)
 * as InsureWise reads it. Used when live AI is off, so the whole journey can be
 * shown without a key. Quotes are verbatim from the sample PDF.
 */

export const SAMPLE_POLICY_URL = "/samples/insurewise-sample-policy.pdf";
export const SAMPLE_FILE_NAME = "Lotus-Family-Secure-sample.pdf";

const c = (
  id: CheckResult["id"],
  status: CheckResult["status"],
  value: string,
  explanation: string,
  quote: string | null,
  page: number | null,
): CheckResult => ({
  id,
  status,
  value,
  explanation,
  quote,
  page,
  verified: Boolean(quote),
  source: "document",
});

const NUMBERS: ReadResult["numbers"] = {
  coPayPercent: 10,
  coPayMinAge: 61,
  roomRentBasis: "percent-of-si",
  roomRentPercent: 1,
  roomRentAmountInr: null,
  roomCategory: "Single private room",
  preDays: 30,
  postDays: 60,
  initialWaitingDays: 30,
  pedMonths: 36,
  specificIllnessMonths: 24,
  specificIllnesses: ["Cataract", "Hernia", "Gallbladder stones", "Joint replacement"],
  maternityCovered: null,
  maternityMonths: null,
  maternityLimitInr: null,
  consumablesCovered: false,
  subLimits: [{ procedure: "Cataract surgery", amountInr: 40000, percentOfSi: null, per: "eye" }],
};

const FACTS: ReadResult["facts"] = {
  insurerName: "Lotus Health Insurance (Sample)",
  productName: "Family Secure Plan",
  policyNumber: "LHS/FSP/2026/004417",
  policyType: "family-floater",
  sumInsuredInr: 500000,
  cumulativeBonusInr: null,
  policyStart: "2026-04-01",
  policyEnd: "2027-03-31",
  firstInception: null,
  insuredPersons: [
    { name: "Meera Raghavan", age: null, relation: null },
    { name: "Arjun Raghavan", age: null, relation: null },
    { name: "Kavya Raghavan", age: null, relation: null },
  ],
  tpaName: "Harbour Health TPA (Sample)",
  helpline: null,
};

const CHECKS: CheckResult[] = [
  c(
    "co-payment",
    "partial",
    "10% from age 61 at entry",
    "Anyone who joined at 61 or older pays 10% of every claim themselves.",
    "A co-payment of 10% applies to every claim for insured persons aged 61 years or above at entry.",
    2,
  ),
  c(
    "room-rent",
    "does-not-meet",
    "Up to 1% of sum insured a day",
    "Your room is capped at ₹5,000 a day. A costlier room cuts many other charges in the same proportion.",
    "Room Rent: Single private room, up to 1% of the Sum Insured per day.",
    1,
  ),
  c(
    "disease-sublimits",
    "partial",
    "Cataract capped at ₹40,000 per eye",
    "Cataract surgery is paid only up to ₹40,000 per eye, whatever the bill.",
    "Cataract surgery is limited to Rs. 40,000 per eye per policy year.",
    3,
  ),
  c(
    "pre-post",
    "partial",
    "30 days before, 60 after",
    "Bills after discharge are covered for 60 days, shorter than the 90 days a good policy gives.",
    "Medical expenses incurred up to 30 days before admission and up to 60 days after discharge are covered, if related to the same condition.",
    2,
  ),
  c(
    "ped-waiting",
    "partial",
    "36 months",
    "Illnesses you had before buying are covered only after 3 years.",
    "Pre-existing diseases are covered after 36 months of continuous coverage from the first policy commencement date.",
    3,
  ),
  c(
    "day-care",
    "meets",
    "Covered",
    "Procedures that need less than a day in hospital are covered.",
    "Day care procedures listed in Annexure I are covered even when hospitalisation is less than 24 hours.",
    2,
  ),
  c(
    "restoration",
    "partial",
    "Once a year, different illness only",
    "Your cover refills once a year, and only for an illness unrelated to the first claim.",
    "100% of the Sum Insured is restored once in a policy year for an unrelated illness after the Sum Insured is exhausted.",
    1,
  ),
  c("no-claim-bonus", "not-found", "Not found", "The sample documents don't mention a no-claim bonus.", null, null),
  c("health-checkup", "not-found", "Not found", "The sample documents don't mention a free health check-up.", null, null),
  c(
    "consumables",
    "does-not-meet",
    "Not payable",
    "Gloves, masks and admission kits are listed as not payable, so you pay for them.",
    "Items listed in Annexure II, such as gloves, masks, admission kits and documentation charges, are not payable.",
    2,
  ),
  c("domiciliary", "not-found", "Not found", "The sample documents don't mention treatment at home.", null, null),
  c("ayush", "not-found", "Not found", "The sample documents don't mention AYUSH treatment.", null, null),
];

export function sampleRead(pageCount: number): ReadResult {
  const files = [{ name: SAMPLE_FILE_NAME, kind: "policy-wording" as const, pages: pageCount }];
  const checks = applyRules(CHECKS, NUMBERS);
  return {
    isHealthInsurancePolicy: true,
    files,
    facts: FACTS,
    numbers: NUMBERS,
    checks: [...checks, sumInsuredCheck(FACTS.sumInsuredInr, false)],
    missing: missingDocs(["policy-wording", "policy-schedule"], FACTS),
    verified: CHECKS.filter((x) => x.quote).length,
    quoted: CHECKS.filter((x) => x.quote).length,
    truncated: false,
    model: "sample",
  };
}
