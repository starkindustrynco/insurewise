import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { combineFiles, readPolicySchema, toReadResult, type ReadRequest, type ReadResult } from "@/domain/policy/read";
import { verifyQuote } from "@/domain/ai/grounding";
import { DECISION_DISCLAIMER, findPromises } from "@/domain/ai/safety";
import { ASK_INSTRUCTIONS, DECODE_INSTRUCTIONS, READ_INSTRUCTIONS } from "./prompts";

export type ThinkingLevel = "minimal" | "low" | "medium" | "high";

/**
 * Gemini 3 models take a thinking level; Gemini 2.x models take a token
 * budget. Less thinking is faster, which matters for a 40-page wording.
 */
export function thinkingOptions(model: string, level: ThinkingLevel) {
  if (/gemini-2(\.|-)/.test(model)) {
    const budget = { minimal: 0, low: 1024, medium: 4096, high: 8192 }[level];
    return { google: { thinkingConfig: { thinkingBudget: budget } } };
  }
  return { google: { thinkingConfig: { thinkingLevel: level } } };
}

export function readThinking(): ThinkingLevel {
  const v = process.env.AI_READ_THINKING?.trim();
  return v === "low" || v === "medium" || v === "high" || v === "minimal" ? v : "low";
}

/** Reads one policy (one or more files) and returns checked results. */
export async function readPolicy(model: LanguageModel, modelName: string, req: ReadRequest): Promise<ReadResult> {
  const combined = combineFiles(req.files);
  const { output } = await generateText({
    model,
    instructions: READ_INSTRUCTIONS,
    prompt: `Files uploaded: ${req.files.map((f) => f.name).join(", ")}\n<document>\n${combined.text}\n</document>`,
    output: Output.object({ schema: readPolicySchema }),
    temperature: 0,
    maxRetries: 1,
    timeout: { totalMs: 140_000 },
    providerOptions: thinkingOptions(modelName, readThinking()),
  });
  return toReadResult(output, req, combined, modelName);
}

// Ask ---------------------------------------------------------------------------

export const askRequestSchema = z.object({
  question: z.string().trim().min(2).max(600),
  language: z.enum(["en", "hi", "ta", "te", "kn"]),
  context: z.string().max(20_000),
  pages: z.array(z.object({ page: z.number().int().min(1), text: z.string().max(12_000) })).max(8),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(3_000) }))
    .max(6)
    .default([]),
});
export type AskRequest = z.infer<typeof askRequestSchema>;

const askOutputSchema = z.object({
  status: z.enum(["answered", "partly", "unclear"]),
  answer: z.string().describe("The answer in the requested language, 1-3 short paragraphs separated by blank lines"),
  answerEnglish: z.string().nullable().describe("The same answer in English when the requested language is not English, else null"),
  citations: z.array(z.object({ page: z.number(), quote: z.string() })).describe("Pages relied on, each with a short exact quote"),
  followUps: z.array(z.string()).describe("Up to 3 short follow-up questions, in the requested language"),
});

export interface AskResult {
  status: "answered" | "partly" | "unclear";
  answer: string;
  answerEnglish: string | null;
  citations: { page: number; quote: string; verified: boolean }[];
  followUps: string[];
  model: string;
}

const LANGUAGE_NAME: Record<string, string> = { en: "English", hi: "Hindi", ta: "Tamil", te: "Telugu", kn: "Kannada" };

export async function askPolicy(model: LanguageModel, modelName: string, req: AskRequest): Promise<AskResult> {
  const doc = req.pages.map((p) => `[Page ${p.page}]\n${p.text}`).join("\n\n");
  const history = req.history.map((h) => `${h.role === "user" ? "Family" : "InsureWise"}: ${h.text}`).join("\n");
  const { output } = await generateText({
    model,
    instructions: ASK_INSTRUCTIONS,
    prompt: `Requested language: ${LANGUAGE_NAME[req.language]}
<context>
${req.context}
</context>
<document>
${doc || "(no pages matched the question)"}
</document>
${history ? `Earlier in this conversation:\n${history}\n` : ""}Question: ${req.question}`,
    output: Output.object({ schema: askOutputSchema }),
    temperature: 0.2,
    maxRetries: 1,
    timeout: { totalMs: 60_000 },
    providerOptions: thinkingOptions(modelName, "low"),
  });
  const texts = req.pages.map((p) => p.text);
  const pageNums = req.pages.map((p) => p.page);
  const seen = new Set<string>();
  const citations = output.citations
    .map((c) => {
      const m = verifyQuote(c.quote, texts);
      return { page: m.verified && m.page ? pageNums[m.page - 1] : c.page, quote: c.quote.trim().slice(0, 400), verified: m.verified };
    })
    .filter((c) => c.verified && !seen.has(`${c.page}`) && seen.add(`${c.page}`))
    .slice(0, 4);
  let answer = output.answer.trim().slice(0, 2_400);
  let english = output.answerEnglish?.trim().slice(0, 2_400) || null;
  if (findPromises(`${english ?? ""} ${req.language === "en" ? answer : ""}`).length) {
    english = english ? `${english}\n\n${DECISION_DISCLAIMER}` : null;
    if (req.language === "en") answer = `${answer}\n\n${DECISION_DISCLAIMER}`;
  }
  return {
    status: output.status,
    answer,
    answerEnglish: req.language === "en" ? null : english,
    citations,
    followUps: output.followUps
      .map((f) => f.trim())
      .filter(Boolean)
      .slice(0, 3),
    model: modelName,
  };
}

// Decode a letter or bill ------------------------------------------------------------

export const decodeRequestSchema = z.object({
  fileName: z.string().max(200),
  /** Text of the letter when the browser could read it. */
  text: z.string().max(60_000).nullable(),
  /** The file itself (base64) when it has no text, e.g. a photo or scanned PDF. */
  file: z
    .object({ mediaType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"]), data: z.string().max(9_000_000) })
    .nullable(),
  policyholder: z.string().max(120),
  context: z.string().max(20_000),
  pages: z.array(z.object({ page: z.number().int().min(1), text: z.string().max(12_000) })).max(10),
});
export type DecodeRequest = z.infer<typeof decodeRequestSchema>;

const decodeOutputSchema = z.object({
  isClaimDocument: z.boolean().describe("False if this is not an insurance or hospital claim letter or bill"),
  documentKind: z.enum([
    "rejection-letter",
    "partial-approval",
    "deduction-letter",
    "query-letter",
    "hospital-bill",
    "settlement-letter",
    "pre-authorisation",
    "other",
  ]),
  from: z.string().nullable(),
  claimNumber: z.string().nullable(),
  patientName: z.string().nullable(),
  summary: z.string(),
  claimedInr: z.number().nullable(),
  approvedInr: z.number().nullable(),
  deductedInr: z.number().nullable(),
  deadline: z.string().nullable().describe("Any reply deadline as written"),
  deductions: z.array(
    z.object({
      item: z.string(),
      amountInr: z.number().nullable(),
      reasonGiven: z.string().describe("The reason as the letter states it, short"),
      explanation: z.string().describe("Plain explanation for the family, 1-2 sentences"),
      policyCheck: z.enum(["consistent", "worth-questioning", "unclear"]),
      policyQuote: z.string().nullable().describe("Exact words from the family's policy <document> that support the check"),
      policyPage: z.number().nullable(),
    }),
  ),
  requestedDocuments: z.array(z.object({ document: z.string(), why: z.string().nullable() })),
  nextSteps: z.array(z.string()),
  draft: z.object({ subject: z.string(), body: z.string() }),
});

export type DecodeOutput = z.infer<typeof decodeOutputSchema>;
export interface DecodeResult extends Omit<DecodeOutput, "deductions"> {
  deductions: (DecodeOutput["deductions"][number] & { quoteVerified: boolean })[];
  model: string;
}

export async function decodeLetter(model: LanguageModel, modelName: string, req: DecodeRequest): Promise<DecodeResult> {
  const doc = req.pages.map((p) => `[Page ${p.page}]\n${p.text}`).join("\n\n");
  const prompt = `Policyholder: ${req.policyholder}
<context>
${req.context}
</context>
<document>
${doc || "(policy pages not available)"}
</document>
The uploaded letter or bill is ${req.text ? "below" : "attached"} (file name: ${req.fileName}).${req.text ? `\n<letter>\n${req.text}\n</letter>` : ""}`;
  const { output } = await generateText({
    model,
    instructions: DECODE_INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: req.file
          ? [
              { type: "text", text: prompt },
              { type: "file", data: req.file.data, mediaType: req.file.mediaType },
            ]
          : [{ type: "text", text: prompt }],
      },
    ],
    output: Output.object({ schema: decodeOutputSchema }),
    temperature: 0.1,
    maxRetries: 1,
    timeout: { totalMs: 90_000 },
    providerOptions: thinkingOptions(modelName, "low"),
  });
  const texts = req.pages.map((p) => p.text);
  const pageNums = req.pages.map((p) => p.page);
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
  let body = output.draft.body.trim().slice(0, 3_000);
  if (findPromises(body).length) body = body.replace(/\b(will be|is) (approved|paid|reimbursed|settled)\b/gi, "can be reviewed");
  return {
    ...output,
    summary: clip(output.summary.trim(), 700),
    deductions: output.deductions.slice(0, 15).map((d) => {
      const m = verifyQuote(d.policyQuote, texts);
      return {
        ...d,
        item: clip(d.item, 120),
        explanation: clip(d.explanation, 400),
        policyQuote: m.verified ? d.policyQuote : null,
        policyPage: m.verified && m.page ? pageNums[m.page - 1] : null,
        // A "consistent" verdict must rest on wording we can find in the policy.
        policyCheck: d.policyCheck === "consistent" && !m.verified ? "unclear" : d.policyCheck,
        quoteVerified: m.verified,
      };
    }),
    requestedDocuments: output.requestedDocuments.slice(0, 12),
    nextSteps: output.nextSteps.slice(0, 5).map((s) => clip(s, 240)),
    draft: { subject: clip(output.draft.subject.trim(), 160), body },
    model: modelName,
  };
}
