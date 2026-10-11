import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/**
 * Server-only AI configuration. Keys are read from the environment
 * (.env.local locally, the Render dashboard in production) and never sent to
 * the browser.
 */

export const DEFAULT_MODEL = "gemini-flash-latest";
export const PROVIDER_LABEL = "Google Gemini";

export interface AiConfig {
  live: boolean;
  provider: string;
  model: string;
  /** Plain reason when live AI is off. Never includes secrets. */
  reason?: string;
}

function apiKey(): string | undefined {
  const k = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  return k && k.trim() ? k.trim() : undefined;
}

export function getAiConfig(): AiConfig {
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
  if (process.env.AI_ENABLED === "false")
    return { live: false, provider: PROVIDER_LABEL, model, reason: "Live AI is switched off on the server (AI_ENABLED=false)." };
  if (!apiKey()) return { live: false, provider: PROVIDER_LABEL, model, reason: "No Gemini API key is configured on the server." };
  return { live: true, provider: PROVIDER_LABEL, model };
}

let cached: { key: string; model: string; base: string; lm: LanguageModel } | null = null;

export function getLanguageModel(): LanguageModel {
  const key = apiKey();
  const cfg = getAiConfig();
  if (!key || !cfg.live) throw new Error(cfg.reason ?? "Live AI is not configured.");
  if (cached && cached.key === key && cached.model === cfg.model && cached.base === (process.env.GOOGLE_GENERATIVE_AI_BASE_URL ?? ""))
    return cached.lm;
  // GOOGLE_GENERATIVE_AI_BASE_URL is optional: for a proxy or a local test double.
  const baseURL = process.env.GOOGLE_GENERATIVE_AI_BASE_URL?.trim() || undefined;
  const google = createGoogleGenerativeAI({ apiKey: key, baseURL });
  const lm = google(cfg.model);
  cached = { key, model: cfg.model, base: process.env.GOOGLE_GENERATIVE_AI_BASE_URL ?? "", lm };
  return lm;
}
