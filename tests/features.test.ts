import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import samplePages from "./fixtures-sample-pages.json";
import { sampleRead } from "@/domain/samples";
import { toPolicy } from "@/lib/intake";
import { TREATMENTS, bestOf, estimateFor } from "@/domain/estimate";
import { cardFor, cardText, decodeCard, encodeCard } from "@/domain/card";
import { pickPages, pagesFor, sampleAnswer, contextFor, terms } from "@/lib/assistant";
import { askPolicy, decodeLetter } from "@/server/ai/services";
import { SAMPLE_DECODE, SAMPLE_LETTER } from "@/domain/sample-letter";
import { verifyQuote } from "@/domain/ai/grounding";
import type { Member, Policy } from "@/domain/types";

const PAGES = samplePages as string[];
const members: Member[] = [
  { id: "m1", name: "Meera Raghavan", relation: "self", age: 38 },
  { id: "m3", name: "Lakshmi Narayanan", relation: "parent", age: 64 },
];
const base = toPolicy({ result: sampleRead(3), live: false }, [{ name: "lotus.pdf", pages: PAGES, size: 1 }], members);
const policy: Policy = { ...base, memberIds: ["m1", "m3"] };
const t = (id: string) => TREATMENTS.find((x) => x.id === id)!;

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

describe("Estimate", () => {
  it("applies the room cap, consumables and co-payment for a parent", () => {
    const e = estimateFor(policy, members[1], t("appendix"), { roomPerDay: 12000, bill: 100000, onDate: "2026-10-11" });
    expect(e.blocked).toBeNull();
    const labels = e.lines.map((l) => l.label);
    expect(labels).toEqual(["Room above your limit", "Cut on other charges", "Gloves, masks and kits", "10% co-payment"]);
    expect(e.lines[0].low).toBe(14000); // (12,000 − 5,000) × 2 days
    expect(e.low + e.paysLow).toBe(100000);
    expect(e.high).toBeGreaterThan(e.low); // consumables 5–10%
  });

  it("says a listed treatment is still in its waiting period", () => {
    const e = estimateFor(policy, members[0], t("knee"), { roomPerDay: 4000, onDate: "2026-10-11" });
    expect(e.blocked).toMatch(/waiting list until 1 Apr 2028/);
    expect(e.paysHigh).toBe(0);
  });

  it("caps cataract at the sub-limit and picks the cheaper policy", () => {
    const later = { ...policy, id: "p2", answers: { firstInception: "2020-01-01" }, facts: { ...policy.facts, policyStart: "2020-01-01" } };
    const capped = estimateFor(later, members[0], t("cataract"), { roomPerDay: 4000, bill: 70000, onDate: "2026-10-11" });
    expect(capped.lines.find((l) => l.label.includes("limit"))!.low).toBe(26500); // 70,000 − 3,500 consumables − 40,000 cap
    const generous: Policy = {
      ...later,
      id: "p3",
      numbers: { ...later.numbers, subLimits: [], consumablesCovered: true, coPayPercent: 0, roomRentBasis: "no-limit" },
    };
    const best = bestOf([capped, estimateFor(generous, members[0], t("cataract"), { roomPerDay: 4000, bill: 70000, onDate: "2026-10-11" })]);
    expect(best!.policyId).toBe("p3");
  });

  it("doesn't treat maternity as covered when the documents don't show it", () => {
    const e = estimateFor(policy, members[0], t("c-section"), { roomPerDay: 4000 });
    expect(e.blocked).toMatch(/isn't found in your documents/);
  });
});

describe("Hospital-ready card", () => {
  it("round-trips through the QR link and reads as plain text", () => {
    const c = cardFor(policy, members[1], "2026-10-11");
    expect(c).toMatchObject({ coPay: 10, room: "Room up to ₹5,000 a day", consumables: "not-covered", sumInsured: "₹5 lakh" });
    expect(c.waiting.map((w) => w.kind)).toEqual(["specific", "ped"]);
    expect(decodeCard(encodeCard(c))).toEqual(c);
    expect(decodeCard("not-a-card")).toBeNull();
    expect(cardText(c)).toMatch(/Co-payment: 10%/);
    expect(cardFor(policy, members[0]).coPay).toBe(0);
  });
});

describe("Assistant", () => {
  it("picks the pages that mention the question's topic", () => {
    expect(pickPages(PAGES, "What is my room rent limit?")[0].page).toBe(1);
    expect(pickPages(PAGES, "Is cataract surgery capped?").map((p) => p.page)).toContain(3);
    expect(pickPages(PAGES, "hello")).toEqual([]);
  });

  it("finds the clause pages for questions in Indian languages", () => {
    expect(terms("माँ को शुगर और बीपी है। क्या इलाज कवर होगा?")).toEqual(expect.arrayContaining(["diabetes", "pre-existing", "hypertension"]));
    expect(terms("அம்மாவுக்கு முழங்கால் அறுவை சிகிச்சை")).toEqual(expect.arrayContaining(["joint", "surgery"]));
    const hindi = pagesFor(policy, "माँ को शुगर और बीपी है। क्या इलाज कवर होगा?").map((p) => p.page);
    expect(hindi).toContain(3);
    // A vague question still gets the key clause pages to cite.
    expect(pagesFor(policy, "hello").length).toBeGreaterThan(0);
  });

  it("answers from the checklist when live AI is off", () => {
    const a = sampleAnswer(policy, "Do I share the bill as co-pay?");
    expect(a.text).toMatch(/Co-payment/);
    expect(a.citations[0].page).toBe(2);
    expect(contextFor(policy, members)).toMatch(/Lakshmi Narayanan \(parent, 64, 10% co-pay\)/);
  });

  it("keeps only citations found on the pages sent, and softens promises", async () => {
    const r = await askPolicy(
      modelReturning({
        status: "answered",
        answer: "Yes, it will be covered.",
        answerEnglish: null,
        citations: [
          { page: 2, quote: "A co-payment of 10% applies to every claim for insured persons aged 61 years or above at entry." },
          { page: 2, quote: "Maternity is covered from day one." },
        ],
        followUps: ["a", "b", "c", "d"],
      }),
      "m",
      { question: "Will it be covered?", language: "en", context: "", pages: [{ page: 2, text: PAGES[1] }], history: [] },
    );
    expect(r.citations).toHaveLength(1);
    expect(r.answer).toMatch(/Only the insurer or TPA decides/);
    expect(r.followUps).toHaveLength(3);
  });
});

describe("Claim decoder", () => {
  it("only calls a deduction consistent when the policy wording backs it", async () => {
    const r = await decodeLetter(
      modelReturning({
        ...SAMPLE_DECODE,
        deductions: SAMPLE_DECODE.deductions.map((d, i) => ({
          ...d,
          policyQuote: i === 1 ? "Consumables are never paid under any circumstances." : d.policyQuote,
        })),
      }),
      "m",
      { fileName: "letter.txt", text: SAMPLE_LETTER, file: null, policyholder: "Meera", context: "", pages: [{ page: 2, text: PAGES[1] }] },
    );
    expect(r.deductions[0]).toMatchObject({ policyCheck: "consistent", quoteVerified: true, policyPage: 2 });
    expect(r.deductions[1]).toMatchObject({ policyCheck: "unclear", quoteVerified: false, policyQuote: null });
    expect(r.deductions[2].policyCheck).toBe("worth-questioning");
  });

  it("ships a sample decode whose quotes are in the sample policy", () => {
    for (const d of SAMPLE_DECODE.deductions) expect(verifyQuote(d.policyQuote, PAGES).verified).toBe(true);
    expect(SAMPLE_DECODE.deductions.reduce((a, d) => a + (d.amountInr ?? 0), 0)).toBe(SAMPLE_DECODE.deductedInr);
  });
});

describe("Upload order", () => {
  it("puts the schedule first and the wording second", async () => {
    const { orderFiles } = await import("@/lib/intake");
    // A real CIS also says "policy wording" and "terms and conditions"; it must still rank after the wording.
    const cis = { name: "cis.pdf", pages: ["CUSTOMER INFORMATION SHEET\nRefer to the policy wording for terms and conditions", ...Array(20).fill("Definitions")], size: 1 };
    const wording = { name: "wording.pdf", pages: ["Definitions", ...Array(46).fill("clause")], size: 1 };
    const schedule = { name: "sched.pdf", pages: ["POLICY SCHEDULE\nDetails of Insured Persons", "x"], size: 1 };
    expect(orderFiles([cis, wording, schedule]).map((f) => f.name)).toEqual(["sched.pdf", "wording.pdf", "cis.pdf"]);
  });
});
