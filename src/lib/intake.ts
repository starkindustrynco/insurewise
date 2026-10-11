import { extractPolicyText, TextExtractionError } from "@/lib/pdf/extract-text";
import { ai, aiStatus, AiError } from "@/lib/ai/client";
import { combineFiles, withAnswers, type ReadResult } from "@/domain/policy/read";
import { verifyQuote } from "@/domain/ai/grounding";
import { SAMPLE_FILE_NAME, SAMPLE_POLICY_URL, sampleRead } from "@/domain/samples";
import type { Member, Policy } from "@/domain/types";
import { newId } from "@/store/app-store";

export interface ReadFile {
  name: string;
  pages: string[];
  size: number;
}

/** Reads text from each file in the browser. Files without text are reported, not sent. */
export async function readFilesText(files: File[]): Promise<{ ok: ReadFile[]; failed: { name: string; reason: string }[] }> {
  const ok: ReadFile[] = [];
  const failed: { name: string; reason: string }[] = [];
  for (const f of files) {
    try {
      const t = await extractPolicyText(f);
      ok.push({ name: f.name, pages: t.pages, size: f.size });
    } catch (e) {
      failed.push({ name: f.name, reason: e instanceof TextExtractionError ? e.message : "This file couldn't be read." });
    }
  }
  return { ok, failed };
}

export async function loadSampleFile(): Promise<ReadFile> {
  const res = await fetch(SAMPLE_POLICY_URL);
  const blob = await res.blob();
  const file = new File([blob], SAMPLE_FILE_NAME, { type: "application/pdf" });
  const t = await extractPolicyText(file);
  return { name: SAMPLE_FILE_NAME, pages: t.pages, size: file.size };
}

export interface AnalyseOutcome {
  result: ReadResult;
  live: boolean;
  readMs?: number;
}

/**
 * Reads a policy with live AI when it's available. The bundled sample policy
 * also works without AI. Other files can't be read without AI, and the error
 * says so plainly instead of substituting something else.
 */
export async function analyse(files: ReadFile[], opts: { isSample: boolean; aiMode: "auto" | "sample" }): Promise<AnalyseOutcome> {
  const status = await aiStatus(true);
  const useLive = status.live && opts.aiMode === "auto";
  if (!useLive) {
    if (opts.isSample) return { result: sampleRead(files[0]?.pages.length ?? 3), live: false };
    throw new AiError(
      opts.aiMode === "sample"
        ? "Live AI is switched off in Settings, so we can't read your file. Turn it on, or try the sample policy."
        : `${status.reason ?? "Live AI isn't available"} Try the sample policy to see how it works.`,
      "ai-off",
    );
  }
  const t0 = Date.now();
  const res = await ai.readPolicy({ files: files.map((f) => ({ name: f.name, pages: f.pages })) });
  return { result: res, live: true, readMs: res.readMs ?? Date.now() - t0 };
}

const HONORIFICS = new Set(["mr", "mrs", "ms", "miss", "smt", "shri", "sri", "dr", "master", "baby", "kumari", "late"]);

/** Name words worth matching on: no honorifics, no initials like "A.". */
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !HONORIFICS.has(t));
}

/**
 * Ticks the family members the schedule names. Schedules write names like
 * "MRS. S. KAMALA RAMESH", so honorifics and initials are ignored. A shared
 * surname alone only counts when the ages agree too.
 */
export function matchMembers(result: ReadResult, members: Member[]): string[] {
  const people = result.facts.insuredPersons.map((p) => ({ tokens: nameTokens(p.name), age: p.age }));
  const matched = members
    .filter((m) => {
      const mine = nameTokens(m.name);
      if (!mine.length) return false;
      return people.some((p) => {
        if (!p.tokens.length) return false;
        if (p.tokens.includes(mine[0])) return true;
        const ageOk = p.age == null || Math.abs(p.age - m.age) <= 2;
        return ageOk && mine.some((t) => p.tokens.includes(t));
      });
    })
    .map((m) => m.id);
  return matched.length ? matched : members.map((m) => m.id);
}

export function toPolicy(outcome: AnalyseOutcome, files: ReadFile[], members: Member[], fallbackReason?: string): Policy {
  const r = outcome.result;
  const combined = combineFiles(files.map((f) => ({ name: f.name, pages: f.pages })));
  // Re-check quotes in the browser too, so the sample engine is held to the same standard.
  const checks = r.checks.map((c) => {
    if (!c.quote) return c;
    const m = verifyQuote(c.quote, combined.pages);
    return { ...c, verified: m.verified, page: m.verified ? m.page : c.page };
  });
  const quoted = checks.filter((c) => c.quote).length;
  return withAnswers({
    id: newId("pol"),
    createdAt: new Date().toISOString(),
    label: r.facts.productName ?? files[0]?.name.replace(/\.[a-z0-9]+$/i, "") ?? "My policy",
    files: r.files,
    pages: combined.pages,
    pageRefs: combined.refs,
    facts: r.facts,
    numbers: r.numbers,
    checks,
    missing: r.missing,
    memberIds: matchMembers(r, members),
    answers: {},
    ai: {
      live: outcome.live,
      model: outcome.live ? r.model : undefined,
      verified: checks.filter((c) => c.quote && c.verified).length,
      quoted,
      readMs: outcome.readMs,
      fallbackReason,
    },
  });
}

/**
 * Sends the schedule first and the wording next, so the facts and the rules
 * come before summaries if a very long upload has to be trimmed.
 */
export function orderFiles<T extends ReadFile>(files: T[]): T[] {
  const rank = (f: T) => {
    const head = f.pages.slice(0, 2).join("\n").toLowerCase();
    if (/policy schedule|schedule of insurance|certificate of insurance|details of insured persons/.test(head) && f.pages.length <= 12) return 0;
    // A customer information sheet also mentions "policy wording", so check for it first.
    if (/customer information sheet|key features document|know your policy/.test(head)) return 2;
    if (f.pages.length >= 15 && /definitions?|terms and conditions|policy wording/.test(f.pages.join(" ").slice(0, 20_000).toLowerCase())) return 1;
    return 2;
  };
  return [...files].sort((a, b) => rank(a) - rank(b));
}
