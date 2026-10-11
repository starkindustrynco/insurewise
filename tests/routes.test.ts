import { afterEach, describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { vi } from "vitest";
import samplePages from "./fixtures-sample-pages.json";

const state = { live: true, output: {} as unknown };

vi.mock("@/server/ai/config", () => ({
  getAiConfig: () =>
    state.live
      ? { live: true, provider: "Google Gemini", model: "mock-model" }
      : { live: false, provider: "Google Gemini", model: "mock-model", reason: "No Gemini API key is configured on the server." },
  getLanguageModel: () =>
    new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: JSON.stringify(state.output) }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
      }),
    }),
}));

const { POST: read } = await import("@/app/api/ai/read-policy/route");
const { GET: health } = await import("@/app/api/health/route");

const post = (body: unknown, ip: string) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

const notFound = { status: "not-found", value: "", explanation: "", quote: null, page: null };
const checks = Object.fromEntries(
  [
    "coPayment",
    "roomRent",
    "diseaseSubLimits",
    "prePostHospitalisation",
    "pedWaiting",
    "dayCare",
    "restoration",
    "noClaimBonus",
    "healthCheckup",
    "consumables",
    "domiciliary",
    "ayush",
  ].map((k) => [k, notFound]),
);
const numbers = {
  coPayPercent: null,
  coPayMinAge: null,
  roomRentBasis: null,
  roomRentPercent: null,
  roomRentAmountInr: null,
  roomCategory: null,
  roomRentTiers: [],
  preDays: null,
  postDays: null,
  initialWaitingDays: null,
  pedMonths: null,
  specificIllnessMonths: null,
  specificIllnesses: [],
  maternityCovered: null,
  maternityMonths: null,
  maternityLimitInr: null,
  consumablesCovered: null,
  subLimits: [],
};
const base = {
  isHealthInsurancePolicy: true,
  files: [{ fileName: "p.pdf", kind: "policy-wording" }],
  insurerName: "Lotus",
  productName: "Family Secure",
  policyNumber: null,
  policyType: null,
  sumInsuredInr: null,
  cumulativeBonusInr: null,
  policyStart: null,
  policyEnd: null,
  firstInception: null,
  insuredPersons: [],
  tpaName: null,
  helpline: null,
  checks,
  numbers,
};

afterEach(() => {
  state.live = true;
});

describe("AI routes", () => {
  it("reports health without secrets", async () => {
    const h = await health().json();
    expect(h.ok).toBe(true);
    expect(JSON.stringify(h)).not.toMatch(/key/i);
  });

  it("reads a policy and returns checked results", async () => {
    state.output = base;
    const res = await read(post({ files: [{ name: "p.pdf", pages: samplePages }] }, "1.1.1.1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checks).toHaveLength(13);
    expect(body.missing.map((m: { kind: string }) => m.kind)).toEqual(["policy-schedule"]);
  });

  it("refuses files with no text and documents that aren't policies", async () => {
    const empty = await read(post({ files: [{ name: "scan.pdf", pages: ["", " "] }] }, "2.2.2.2"));
    expect(empty.status).toBe(422);
    expect((await empty.json()).error.code).toBe("no-text");
    state.output = { ...base, isHealthInsurancePolicy: false };
    const notPolicy = await read(post({ files: [{ name: "menu.pdf", pages: samplePages }] }, "3.3.3.3"));
    expect((await notPolicy.json()).error.code).toBe("not-policy");
  });

  it("returns 503 when live AI is off", async () => {
    state.live = false;
    const res = await read(post({ files: [{ name: "p.pdf", pages: samplePages }] }, "4.4.4.4"));
    expect(res.status).toBe(503);
  });
});
