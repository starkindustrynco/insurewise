import { describe, expect, it, vi, afterEach } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import samplePages from "./fixtures-sample-pages.json";
import { readPolicySchema, toReadResult, combineFiles, missingDocs, withAnswers, tierFor, subLimitGuard, coPayFromCheck, type ReadPolicyOutput } from "@/domain/policy/read";
import { verdictFor, nextStepsFor, sumInsuredCheck, applyRules, coPayFor, labelFor, coverText, tidyName } from "@/domain/policy/framework";
import { waitingFor } from "@/domain/policy/waiting";
import { sampleRead } from "@/domain/samples";
import { readPolicy } from "@/server/ai/services";
import { verifyQuote } from "@/domain/ai/grounding";
import { providerError } from "@/server/ai/guard";
import { matchMembers, toPolicy } from "@/lib/intake";
import type { CheckResult, Member, Policy } from "@/domain/types";

const PAGES = samplePages as string[];
const FILES = [{ name: "lotus.pdf", pages: PAGES }];

const members: Member[] = [
  { id: "m1", name: "Meera Raghavan", relation: "self", age: 38 },
  { id: "m2", name: "Arjun Raghavan", relation: "spouse", age: 40 },
  { id: "m3", name: "Lakshmi Narayanan", relation: "parent", age: 64 },
];

function item(status: "meets" | "partial" | "does-not-meet" | "not-found", value = "", quote: string | null = null, page: number | null = null) {
  return { status, value, explanation: "x", quote, page };
}

const OUTPUT: ReadPolicyOutput = {
  isHealthInsurancePolicy: true,
  files: [{ fileName: "lotus.pdf", kind: "policy-wording" }],
  insurerName: "Lotus Health Insurance (Sample)",
  productName: "Family Secure Plan",
  policyNumber: "LHS/FSP/2026/004417",
  policyType: "family-floater",
  sumInsuredInr: 500000,
  cumulativeBonusInr: null,
  policyStart: "2026-04-01",
  policyEnd: "2027-03-31",
  firstInception: null,
  insuredPersons: [{ name: "Meera Raghavan", age: null, relation: null }],
  tpaName: "Harbour Health TPA (Sample)",
  helpline: null,
  checks: {
    coPayment: item("meets", "None", "A co-payment of 10% applies to every claim for insured persons aged 61 years or above at entry.", 3),
    roomRent: item("does-not-meet", "1% of SI", "Room Rent: Single private room, up to 1% of the Sum Insured per day.", 1),
    diseaseSubLimits: item("partial", "Cataract", "Cataract surgery is limited to Rs. 40,000 per eye per policy year.", 3),
    prePostHospitalisation: item(
      "meets",
      "",
      "Medical expenses incurred up to 30 days before admission and up to 60 days after discharge are covered",
      2,
    ),
    pedWaiting: item("meets", "", "Pre-existing diseases are covered after 36 months of continuous coverage", 3),
    dayCare: item("meets", "Covered", "Day care procedures listed in Annexure I are covered", 2),
    restoration: item("partial", "Once", "Maternity is covered from day one with no limit.", 1), // not in the document
    noClaimBonus: item("not-found"),
    healthCheckup: item("not-found"),
    consumables: item("does-not-meet", "", "such as gloves, masks, admission kits and documentation charges, are not payable", 2),
    domiciliary: item("not-found"),
    ayush: item("not-found"),
  },
  numbers: {
    coPayPercent: 10,
    coPayMinAge: 61,
    roomRentBasis: "percent-of-si",
    roomRentPercent: 1,
    roomRentAmountInr: null,
    roomCategory: "Single private room",
    roomRentTiers: [],
    preDays: 30,
    postDays: 60,
    initialWaitingDays: 30,
    pedMonths: 36,
    specificIllnessMonths: 24,
    specificIllnesses: ["Cataract", "Hernia"],
    maternityCovered: null,
    maternityMonths: null,
    maternityLimitInr: null,
    consumablesCovered: false,
    subLimits: [{ procedure: "Cataract", amountInr: 40000, percentOfSi: null, per: "eye" }],
  },
};

function modelReturning(obj: unknown) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(obj) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

describe("Reading a policy", () => {
  it("sends Gemini a schema without length or count limits", async () => {
    let body = "";
    const google = createGoogleGenerativeAI({
      apiKey: "test",
      fetch: async (_u, init) => {
        body = String(init?.body);
        return new Response("{}", { status: 400 });
      },
    });
    await generateText({ model: google("gemini-test"), prompt: "x", output: Output.object({ schema: readPolicySchema }), maxRetries: 0 }).catch(
      () => undefined,
    );
    const schema = JSON.stringify(JSON.parse(body).generationConfig.responseJsonSchema);
    expect(schema.length).toBeGreaterThan(1000);
    expect(schema).not.toMatch(/"(maxItems|minItems|maxLength|minLength)"/);
  });

  it("checks every quote, corrects pages and applies the numeric rules", async () => {
    const r = await readPolicy(modelReturning(OUTPUT), "gemini-test", { files: FILES });
    const by = (id: string) => r.checks.find((c) => c.id === id)!;
    // The model said co-pay "meets"; the numbers show 10% from 61, so the rule makes it partial.
    expect(by("co-payment").status).toBe("partial");
    expect(by("co-payment").verified).toBe(true);
    expect(by("co-payment").page).toBe(2);
    // 30/60 days is below the 30/90 minimum.
    expect(by("pre-post").status).toBe("partial");
    // 36 months is longer than the 24 that counts as good.
    expect(by("ped-waiting").status).toBe("partial");
    // A made-up quote is kept but flagged.
    expect(by("restoration").verified).toBe(false);
    expect(r.quoted).toBe(8);
    expect(r.verified).toBe(7);
    expect(by("sum-insured").status).toBe("partial");
    expect(r.missing).toEqual([]);
  });

  it("asks for the wording when only a schedule was uploaded, and doesn't trust 'no restriction' without it", () => {
    const out: ReadPolicyOutput = {
      ...OUTPUT,
      files: [{ fileName: "lotus.pdf", kind: "policy-schedule" }],
      checks: { ...OUTPUT.checks, coPayment: item("meets", "No co-payment clause") },
      numbers: { ...OUTPUT.numbers, coPayPercent: null },
    };
    const r = toReadResult(out, { files: FILES }, combineFiles(FILES), "m");
    expect(r.checks.find((c) => c.id === "co-payment")!.status).toBe("not-found");
    expect(r.missing.map((m) => m.kind)).toEqual(["policy-wording"]);
    expect(missingDocs(["policy-wording"], { sumInsuredInr: null }).map((m) => m.kind)).toEqual(["policy-schedule"]);
  });
});

describe("Verdict", () => {
  it("scores the sample policy and finds its red flag", () => {
    const r = sampleRead(3);
    for (const c of r.checks.filter((x) => x.quote)) expect(verifyQuote(c.quote, PAGES).verified).toBe(true);
    const v = verdictFor(r.checks);
    expect(v.score).toBe(40);
    expect(v.label).toBe("Needs attention");
    expect(v.mustMet).toBe(1);
    expect(v.redFlags.map((c) => c.id)).toEqual(["room-rent"]);
  });

  it("labels scores and cover amounts", () => {
    expect([labelFor(85), labelFor(70), labelFor(50), labelFor(20)]).toEqual(["Excellent", "Good", "Fair", "Needs attention"]);
    expect(sumInsuredCheck(1_500_000, false).status).toBe("meets");
    expect(sumInsuredCheck(500_000, true)).toMatchObject({ status: "partial", source: "you", value: "₹5 lakh" });
    expect(sumInsuredCheck(null, false).status).toBe("not-found");
  });

  it("never upgrades a capped room to a pass", () => {
    const [c] = applyRules(
      [{ id: "room-rent", status: "meets", value: "", explanation: "", quote: null, page: null, verified: false, source: "document" }],
      {
        ...OUTPUT.numbers,
        roomRentBasis: "fixed-per-day",
        roomRentAmountInr: 4000,
      },
    );
    expect(c.status).toBe("does-not-meet");
  });

  it("turns the verdict into a few concrete next steps", () => {
    const p = toPolicy({ result: sampleRead(3), live: false }, [{ name: "lotus.pdf", pages: PAGES, size: 1 }], members);
    const steps = nextStepsFor(p, members);
    expect(steps[0].title).toBe("Keep the room within ₹5,000 a day");
    expect(steps.find((s) => s.id === "copay")!.title).toBe("Lakshmi will pay 10% of each claim");
    expect(coPayFor(p.numbers, members[0])).toBe(0);
    expect(coPayFor(p.numbers, members[2])).toBe(10);
  });

  it("drops the waiting-period step once the pre-existing illness wait is over", () => {
    const p = toPolicy({ result: sampleRead(3), live: false }, [{ name: "lotus.pdf", pages: PAGES, size: 1 }], members);
    expect(nextStepsFor(p, members.slice(0, 2), "2026-10-11").some((s) => s.id === "ped")).toBe(true);
    expect(nextStepsFor(p, members.slice(0, 2), "2030-01-01").some((s) => s.id === "ped")).toBe(false);
  });
});

describe("Policy record", () => {
  it("matches the schedule's names to family members and applies answers", () => {
    const p = toPolicy(
      { result: { ...sampleRead(3), facts: { ...sampleRead(3).facts, sumInsuredInr: null } }, live: false },
      [{ name: "lotus.pdf", pages: PAGES, size: 1 }],
      members,
    );
    expect(p.memberIds).toEqual(["m1", "m2"]);
    expect(p.missing.map((m) => m.kind)).toEqual(["policy-schedule"]);
    const answered: Policy = withAnswers({ ...p, answers: { sumInsuredInr: 1_000_000 } });
    expect(answered.checks.find((c) => c.id === "sum-insured")).toMatchObject({ status: "meets", source: "you" });
    expect(answered.missing).toEqual([]);
  });
});

describe("Waiting periods", () => {
  it("counts down from the policy start", () => {
    const p = toPolicy({ result: sampleRead(3), live: false }, [{ name: "lotus.pdf", pages: PAGES, size: 1 }], members);
    const w = waitingFor(p, "2026-10-11");
    const by = (k: string) => w.find((x) => x.kind === k)!;
    expect(by("initial")).toMatchObject({ endsOn: "2026-05-01", done: true });
    expect(by("specific")).toMatchObject({ endsOn: "2028-04-01", done: false });
    expect(by("specific").daysLeft).toBe(538);
    expect(by("ped").endsOn).toBe("2029-04-01");
  });

  it("asks for a start date when none is known", () => {
    const base = toPolicy({ result: sampleRead(3), live: false }, [{ name: "lotus.pdf", pages: PAGES, size: 1 }], members);
    const p: Policy = { ...base, facts: { ...base.facts, policyStart: null } };
    expect(waitingFor(p, "2026-10-11").every((x) => x.endsOn === null)).toBe(true);
    expect(waitingFor({ ...p, answers: { firstInception: "2023-01-01" } }, "2026-10-11").find((x) => x.kind === "ped")!.done).toBe(true);
  });
});

describe("Provider errors", () => {
  afterEach(() => vi.unstubAllEnvs());
  const apiError = (statusCode: number, body: unknown) =>
    Object.assign(new Error("Request failed"), { name: "AI_APICallError", statusCode, responseBody: JSON.stringify(body) });

  it("names rejected requests and daily quotas", async () => {
    const rejected = await providerError(
      apiError(400, { error: { status: "INVALID_ARGUMENT", message: "Request contains an invalid argument." } }),
    ).json();
    expect(rejected.error.code).toBe("provider-rejected");
    const daily = apiError(429, {
      error: { details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }, { retryDelay: "41s" }] },
    });
    expect((await providerError(daily).json()).error.code).toBe("provider-quota");
    vi.stubEnv("NODE_ENV", "production");
    expect((await providerError(apiError(400, { error: { message: "x" } })).json()).error.detail).toBeUndefined();
  });
});

describe("Cover amount with bonus", () => {
  it("counts a cumulative bonus already earned", () => {
    expect(sumInsuredCheck(500_000, false, 250_000)).toMatchObject({ status: "partial", value: "₹5 lakh + ₹2.5 lakh bonus" });
    expect(sumInsuredCheck(500_000, false, 500_000).status).toBe("meets");
    const p = toPolicy({ result: sampleRead(3), live: false }, [{ name: "lotus.pdf", pages: PAGES, size: 1 }], members);
    expect(coverText({ ...p, facts: { ...p.facts, sumInsuredInr: 500_000, cumulativeBonusInr: 250_000 } })).toBe("₹7.5 lakh cover with bonus");
  });
});

describe("Schedule names", () => {
  it("ignores honorifics and initials, and needs ages to agree on a shared surname", () => {
    const family: Member[] = [
      { id: "a", name: "Ravi Thomas", relation: "self", age: 30 },
      { id: "b", name: "Kamala Ramesh", relation: "parent", age: 53 },
      { id: "c", name: "Priya Ramesh", relation: "sibling", age: 25 },
    ];
    const read = (people: { name: string; age: number | null }[]) => {
      const r = sampleRead(3);
      return { ...r, facts: { ...r.facts, insuredPersons: people.map((x) => ({ ...x, relation: null })) } };
    };
    expect(matchMembers(read([{ name: "MRS. S. KAMALA RAMESH", age: 53 }]), family)).toEqual(["b"]);
    expect(matchMembers(read([{ name: "Smt. K. Ramesh", age: 52 }]), family)).toEqual(["b"]);
    expect(matchMembers(read([{ name: "Someone Else", age: 40 }]), family)).toEqual(["a", "b", "c"]);
    expect(tidyName("LOTUS HEALTH AND ALLIED INSURANCE COMPANY LIMITED")).toBe("Lotus Health and Allied Insurance Company Limited");
    expect(tidyName("Lotus Health")).toBe("Lotus Health");
    expect(tidyName("Lotus Health And Allied Insurance")).toBe("Lotus Health and Allied Insurance");
  });
});

describe("Room rent tables", () => {
  // Shaped like a real insurer's table: the cap depends on the sum insured.
  const TABLE_PAGE = "Room Rent Criteria\n5/7.5 10/15/20/25 50/75/100/200\nUp to 1% of Sum Insured per day\nAny Room (Except suite or above category)\nAny room";
  const tiers: ReadPolicyOutput["numbers"]["roomRentTiers"] = [
    { sumInsuredOptionsInr: [500_000, 750_000], basis: "percent-of-si", percent: 1, amountInr: null, category: null, quote: "Up to 1% of Sum Insured per day", page: 1 },
    { sumInsuredOptionsInr: [1_000_000, 1_500_000, 2_000_000, 2_500_000], basis: "category", percent: null, amountInr: null, category: "Any Room (Except suite or above category)", quote: "Any Room (Except suite or above category)", page: 1 },
    { sumInsuredOptionsInr: [5_000_000, 7_500_000], basis: "no-limit", percent: null, amountInr: null, category: "Any room", quote: "Any room", page: 1 },
  ];
  const read = (si: number | null, roomStatus: "meets" | "does-not-meet") =>
    toReadResult(
      {
        ...OUTPUT,
        sumInsuredInr: si,
        checks: { ...OUTPUT.checks, roomRent: item(roomStatus, "Any Room (Except suite or above category)", "Any Room (Except suite or above category)", 1) },
        numbers: { ...OUTPUT.numbers, roomRentBasis: "tiered-by-sum-insured", roomRentPercent: null, roomCategory: null, roomRentTiers: tiers },
      },
      { files: [{ name: "w.pdf", pages: [TABLE_PAGE] }] },
      combineFiles([{ name: "w.pdf", pages: [TABLE_PAGE] }]),
      "m",
    );

  it("picks the tier for this policy's sum insured, whatever column the model judged", () => {
    const r = read(500_000, "meets");
    const room = r.checks.find((c) => c.id === "room-rent")!;
    expect(room).toMatchObject({ status: "does-not-meet", value: "Up to ₹5,000 a day", verified: true });
    expect(r.numbers).toMatchObject({ roomRentBasis: "percent-of-si", roomRentPercent: 1 });
    expect(read(1_500_000, "does-not-meet").checks.find((c) => c.id === "room-rent")!.status).toBe("meets");
    expect(tierFor(tiers, 1_200_000)?.category).toBe("Any Room (Except suite or above category)");
    expect(tierFor(tiers, 300_000)).toBeNull();
  });

  it("re-picks the tier when the family tells us the sum insured", () => {
    const r = read(null, "meets");
    expect(r.checks.find((c) => c.id === "room-rent")!.status).toBe("meets");
    const p = toPolicy({ result: r, live: true }, [{ name: "w.pdf", pages: [TABLE_PAGE], size: 1 }], members);
    const answered = withAnswers({ ...p, answers: { sumInsuredInr: 500_000 } });
    expect(answered.checks.find((c) => c.id === "room-rent")!.status).toBe("does-not-meet");
  });
});

describe("Disease sub-limits", () => {
  it("doesn't accept 'no caps' when the model listed caps on treatments", () => {
    const withCaps = (subLimits: ReadPolicyOutput["numbers"]["subLimits"]) =>
      applyRules([{ id: "disease-sublimits", status: "meets", value: "", explanation: "", quote: null, page: null, verified: false, source: "document" }], {
        ...OUTPUT.numbers,
        roomRentTiers: [],
        subLimits,
      })[0];
    const cap = (procedure: string) => ({ procedure, amountInr: null, percentOfSi: 10, per: "policy year" });
    expect(withCaps([cap("Delivery expenses"), cap("Air ambulance")]).status).toBe("meets");
    expect(withCaps([cap("Chronic severe refractory asthma"), cap("Delivery expenses")])).toMatchObject({ status: "partial", value: "Caps on Chronic severe refractory asthma" });
    expect(withCaps([cap("Cataract")]).status).toBe("does-not-meet");
  });

  it("shows a sub-limit clause from the wording when the model said 'no caps' without a quote", () => {
    const meets: CheckResult = { id: "disease-sublimits", status: "meets", value: "None", explanation: "", quote: null, page: null, verified: false, source: "document" };
    const pages = [
      "Note: The above mentioned sublimits will not apply for treatment of the new born baby up to Rs. 2,00,000.",
      "Rehabilitation and Pain Management: The company will pay the medical expenses for Rehabilitation and Pain Management up to the sub-limit (or) maximum up to 20% of the Sum Insured whichever is less, per Policy Year.",
    ];
    expect(subLimitGuard([meets], pages)[0]).toMatchObject({ status: "partial", page: 2, verified: true });
    expect(subLimitGuard([meets], ["Sum Insured including sublimits is for each year."])[0].status).toBe("meets");
  });
});

describe("Co-payment by entry age", () => {
  const quote =
    "This policy is subject to co-payment of 10% of each and every claim amount for fresh as well as renewal policies for Insured Person whose age at the time of entry is 61 years and above.";
  const check: CheckResult = { id: "co-payment", status: "partial", value: "10% for entry age 61+", explanation: "", quote, page: 1, verified: true, source: "document" };

  it("fills the numbers from the check when the model left them out", () => {
    const n = coPayFromCheck({ ...OUTPUT.numbers, roomRentTiers: [], coPayPercent: null, coPayMinAge: null }, [check]);
    expect(n).toMatchObject({ coPayPercent: 10, coPayMinAge: 61, coPayOnEntryAge: true });
  });

  it("uses the age when cover started, not today's age", () => {
    const n = coPayFromCheck({ ...OUTPUT.numbers, roomRentTiers: [] }, [check]);
    const parent = (age: number): Member => ({ id: "p", name: "Parent", relation: "parent", age });
    // Joined in 2012: a 66-year-old today joined at 52, so no co-payment.
    expect(coPayFor(n, parent(66), "2012-07-03", "2026-10-11")).toBe(0);
    // Joined last year at about 62: co-payment applies.
    expect(coPayFor(n, parent(63), "2025-09-01", "2026-10-11")).toBe(10);
    // Without a start date, today's age is used.
    expect(coPayFor(n, parent(63))).toBe(10);
  });
});

