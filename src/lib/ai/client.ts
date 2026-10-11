import type { AiConfig } from "@/server/ai/config";
import type { ReadRequest, ReadResult } from "@/domain/policy/read";
import type { AskRequest, AskResult, DecodeRequest, DecodeResult } from "@/server/ai/services";

/** Browser-side calls to InsureWise's AI routes. The API key never reaches the browser. */

export class AiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

const OFFLINE: AiConfig = { live: false, provider: "Google Gemini", model: "", reason: "The AI service couldn't be reached." };

let cached: { at: number; value: AiConfig } | null = null;

export async function aiStatus(force = false): Promise<AiConfig> {
  if (!force && cached && Date.now() - cached.at < 60_000) return cached.value;
  try {
    const res = await fetch("/api/ai/status", { cache: "no-store" });
    const value = res.ok ? ((await res.json()) as AiConfig) : OFFLINE;
    cached = { at: Date.now(), value };
    return value;
  } catch {
    return OFFLINE;
  }
}

export async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const timedOut = (e as Error)?.name === "TimeoutError";
    throw new AiError(timedOut ? "Reading took too long. Try again." : "The AI service couldn't be reached.", timedOut ? "timeout" : "network");
  }
  const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string; detail?: string } } | null;
  if (!res.ok) {
    const err = data?.error;
    if (err?.detail) console.warn(`[InsureWise AI] ${err.code}: ${err.detail}`);
    throw new AiError(err?.message ?? `The AI service returned an error (${res.status}).`, err?.code ?? "http", res.status);
  }
  return data as T;
}

export const ai = {
  readPolicy: (req: ReadRequest) => post<ReadResult & { readMs: number }>("/api/ai/read-policy", req, 170_000),
  ask: (req: AskRequest) => post<AskResult>("/api/ai/ask", req, 75_000),
  decode: (req: DecodeRequest) => post<DecodeResult>("/api/ai/decode", req, 110_000),
};
