import type { DecodeResult } from "@/server/ai/services";

/** A fictional partial-approval letter that goes with the sample policy. */
export const SAMPLE_LETTER_NAME = "TPA-final-authorisation-sample.txt";

export const SAMPLE_LETTER = `Harbour Health TPA (Sample)
FINAL AUTHORISATION LETTER (CASHLESS) - PARTIAL APPROVAL

Date: 02-Sep-2026
Claim No: HH-CL-772018
Patient: Meera Raghavan
Policy No: LHS/FSP/2026/004417 (Lotus Health Insurance (Sample), Family Secure Plan)
Hospital: Vriksha Multispeciality Hospital, Jayanagar
Admission: 18-Aug-2026   Discharge: 20-Aug-2026
Diagnosis: Right ureteric calculus. Procedure: Ureteroscopy with laser lithotripsy.

Amount claimed (final bill): Rs. 1,12,450
Amount approved: Rs. 86,300

Deductions:
1. Proportionate deduction as per room rent eligibility (eligible room rent Rs. 5,000 per day, room availed Rs. 7,500 per day): Rs. 14,200
2. Non-payable items - gloves, masks, admission kit, documentation charges: Rs. 6,950
3. Pharmacy charges deducted as per policy terms: Rs. 5,000

Total deductions: Rs. 26,150

The balance amount of Rs. 26,150 is to be settled by the insured directly with the hospital.
For any clarification, write to us within 15 days quoting the claim number.

This is a fictional sample letter for the InsureWise demo.`;

/** How InsureWise decodes the sample letter when live AI is off. Policy quotes are verbatim from the sample policy. */
export const SAMPLE_DECODE: DecodeResult = {
  isClaimDocument: true,
  documentKind: "partial-approval",
  from: "Harbour Health TPA (Sample)",
  claimNumber: "HH-CL-772018",
  patientName: "Meera Raghavan",
  summary:
    "Your cashless claim for the kidney stone procedure was partly approved: ₹86,300 of ₹1,12,450. Three deductions add up to ₹26,150, which the hospital will ask you to pay. You can write to the TPA within 15 days if you want a clarification.",
  claimedInr: 112450,
  approvedInr: 86300,
  deductedInr: 26150,
  deadline: "Within 15 days of 02-Sep-2026",
  deductions: [
    {
      item: "Proportionate deduction for the room",
      amountInr: 14200,
      reasonGiven: "Room availed ₹7,500 a day against eligible ₹5,000 a day",
      explanation: "Your room cost more than your ₹5,000 a day limit, so other charges were cut in the same proportion. Your policy allows this.",
      policyCheck: "consistent",
      policyQuote:
        "If the insured person occupies a room category higher than the eligible room, all associated medical expenses shall be payable in the proportion that the eligible room rent bears to the actual room rent.",
      policyPage: 2,
      quoteVerified: true,
    },
    {
      item: "Gloves, masks, admission kit, documentation",
      amountInr: 6950,
      reasonGiven: "Non-payable items",
      explanation: "Your policy lists these items as not payable.",
      policyCheck: "consistent",
      policyQuote: "Items listed in Annexure II, such as gloves, masks, admission kits and documentation charges, are not payable.",
      policyPage: 2,
      quoteVerified: true,
    },
    {
      item: "Pharmacy charges",
      amountInr: 5000,
      reasonGiven: "Deducted as per policy terms (no clause named)",
      explanation:
        "The letter doesn't say which rule this is. Your policy says the room-based cut does not apply to pharmacy, so ask which clause allows this deduction and how it was calculated.",
      policyCheck: "worth-questioning",
      policyQuote: "This does not apply to pharmacy, implants, consumables and diagnostics.",
      policyPage: 2,
      quoteVerified: true,
    },
  ],
  requestedDocuments: [],
  nextSteps: [
    "Ask the TPA, in writing and within 15 days, which clause the ₹5,000 pharmacy deduction is based on and how it was worked out.",
    "Before paying the hospital, ask for the itemised bill so you can match each deduction.",
    "If the reply doesn't settle it, write to Lotus Health's grievance team, then IRDAI's Bima Bharosa portal or the Insurance Ombudsman.",
  ],
  draft: {
    subject: "Clarification on deductions: Claim HH-CL-772018, Policy LHS/FSP/2026/004417",
    body: `Dear Claims Team,

I am writing about the final authorisation dated 02-Sep-2026 for claim HH-CL-772018 (patient: Meera Raghavan, policy LHS/FSP/2026/004417). The letter approves Rs. 86,300 of Rs. 1,12,450.

Please explain the Rs. 5,000 deducted from pharmacy charges "as per policy terms". Clause 3.4 of my policy says the proportionate deduction for room rent does not apply to pharmacy. Please share the clause this deduction is based on and how it was calculated.

Please also share the line-by-line working for the Rs. 14,200 proportionate deduction.

Thank you. I look forward to your reply.

Regards,
Meera Raghavan`,
  },
  model: "sample",
};
