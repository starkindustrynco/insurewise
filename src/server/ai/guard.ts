import type { z } from "zod";

/**
 * Small request guards for the AI routes: a per-client rate limit (in
 * memory, which suits a single Render instance or local dev), a body size
 * cap and schema validation. Errors are returned as JSON the client can show.
 */

const WINDOW_MS = 60_000;
const LIMIT = Number(process.env.AI_RATE_LIMIT_PER_MINUTE || 20);
const hits = new Map<string, number[]>();

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();
}

export function rateLimited(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5_000) hits.clear();
  return false;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export function errorJson(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

export async function readBody<T>(
  req: Request,
  schema: z.ZodType<T>,
  maxBytes: number,
): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) return { ok: false, res: errorJson(413, "too-large", "The request is too large to analyse.") };
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { ok: false, res: errorJson(400, "bad-request", "The request body could not be read.") };
  }
  if (raw.length > maxBytes) return { ok: false, res: errorJson(413, "too-large", "The request is too large to analyse.") };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, res: errorJson(400, "bad-json", "The request body is not valid JSON.") };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) return { ok: false, res: errorJson(400, "invalid", "The request is missing required fields.") };
  return { ok: true, data: result.data };
}

type ProviderErr = {
  name?: string;
  message?: string;
  statusCode?: number;
  responseBody?: string;
  cause?: { code?: string; message?: string; name?: string };
};

/** The provider's own error message (Google returns {error:{message}}), trimmed. Never contains the key. */
export function providerMessage(e: unknown): string {
  const inner = ((e as { lastError?: unknown })?.lastError ?? e) as ProviderErr;
  let msg = inner?.message ?? "";
  if (inner?.responseBody) {
    try {
      const parsed = JSON.parse(inner.responseBody) as { error?: { message?: string; status?: string } };
      if (parsed.error?.message) msg = `${parsed.error.status ?? ""} ${parsed.error.message}`.trim();
    } catch {
      /* keep the SDK message */
    }
  }
  return msg.replace(/key=[^&\s]+/gi, "key=<redacted>").slice(0, 400);
}

/** Error details are added outside production (or with AI_DEBUG_ERRORS=true) so local testing shows the real cause. */
function showDetail(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.AI_DEBUG_ERRORS === "true";
}

/** Reads Google's quota details from a 429 body: whether a daily quota ran out and the suggested wait. */
export function quotaInfo(e: unknown): { daily: boolean; retrySeconds: number | null } {
  const inner = ((e as { lastError?: unknown })?.lastError ?? e) as ProviderErr;
  try {
    const body = JSON.parse(inner?.responseBody ?? "{}") as {
      error?: { details?: { "@type"?: string; violations?: { quotaId?: string }[]; retryDelay?: string }[] };
    };
    const details = body.error?.details ?? [];
    const daily = details.some((d) => d.violations?.some((v) => /PerDay/i.test(v.quotaId ?? "")));
    const delay = details.find((d) => d.retryDelay)?.retryDelay;
    const retrySeconds = delay ? Math.ceil(parseFloat(delay)) : null;
    return { daily, retrySeconds: Number.isFinite(retrySeconds) ? retrySeconds : null };
  } catch {
    return { daily: false, retrySeconds: null };
  }
}

function classify(e: unknown): [number, string, string] {
  const inner = ((e as { lastError?: unknown })?.lastError ?? e) as ProviderErr;
  const status = inner?.statusCode;
  const name = `${(e as { name?: string })?.name ?? ""} ${inner?.name ?? ""} ${inner?.cause?.name ?? ""}`;
  const detail = `${inner?.message ?? ""} ${inner?.cause?.code ?? ""}`;
  if (/Cannot connect to API|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN/.test(detail))
    return [
      502,
      "provider-unreachable",
      "The server couldn't reach Google Gemini. Check that it has internet access to generativelanguage.googleapis.com.",
    ];
  if (status === 429) {
    const q = quotaInfo(e);
    if (q.daily)
      return [
        503,
        "provider-quota",
        "The Gemini API key has used its daily request limit for this model. Live AI works again after the quota resets, or set AI_MODEL to another model.",
      ];
    const wait = q.retrySeconds && q.retrySeconds > 5 ? `about ${q.retrySeconds} seconds` : "a minute";
    return [503, "provider-busy", `The AI provider is rate limiting requests. Try again in ${wait}.`];
  }
  if (status === 401 || status === 403) return [503, "provider-auth", "The AI provider rejected the server's API key."];
  if (status === 404) return [502, "provider-model", "The configured AI model isn't available for this API key. Check AI_MODEL."];
  if (status === 400) return [502, "provider-rejected", "The AI provider rejected the request as invalid."];
  if (status !== undefined && status >= 500) return [503, "provider-down", "The AI provider had a temporary problem. Try again shortly."];
  if (name.includes("NoObjectGenerated") || name.includes("NoOutputGenerated"))
    return [502, "bad-output", "The AI response didn't match the expected format."];
  if (name.includes("TimeoutError") || name.includes("AbortError")) return [504, "timeout", "The AI provider took too long to respond."];
  return [502, "provider-error", "The AI provider couldn't complete the request."];
}

/** Maps provider errors to messages that are safe to show and never include keys or document text. */
export function providerError(e: unknown): Response {
  const [status, code, message] = classify(e);
  return json({ error: { code, message, ...(showDetail() ? { detail: providerMessage(e) } : {}) } }, status);
}

/** Logs a provider failure without request content or keys. */
export function logAiError(route: string, e: unknown): void {
  const err = e as { name?: string; lastError?: ProviderErr } & ProviderErr;
  const inner = err.lastError ?? err;
  console.error(`[${route}]`, err.name ?? "Error", inner.statusCode ?? "", providerMessage(e), inner.cause?.code ?? "");
}
