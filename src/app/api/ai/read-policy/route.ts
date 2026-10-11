import { getAiConfig, getLanguageModel } from "@/server/ai/config";
import { clientKey, errorJson, json, logAiError, providerError, rateLimited, readBody } from "@/server/ai/guard";
import { readRequestSchema } from "@/domain/policy/read";
import { readPolicy } from "@/server/ai/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 160;

/** Reads uploaded policy text with Gemini. Text is extracted in the browser; the key stays here. */
export async function POST(req: Request) {
  const cfg = getAiConfig();
  if (!cfg.live) return errorJson(503, "ai-off", cfg.reason ?? "Live AI is not configured.");
  if (rateLimited(clientKey(req))) return errorJson(429, "rate-limited", "Too many AI requests. Wait a minute and try again.");
  const body = await readBody(req, readRequestSchema, 3_000_000);
  if (!body.ok) return body.res;
  const chars = body.data.files.reduce((a, f) => a + f.pages.join("").replace(/\s/g, "").length, 0);
  if (chars < 200)
    return errorJson(
      422,
      "no-text",
      "We couldn't find text in this file. It may be a scanned image. Try the PDF your insurer emailed you, or a sample policy.",
    );
  try {
    const t0 = Date.now();
    const result = await readPolicy(getLanguageModel(), cfg.model, body.data);
    if (!result.isHealthInsurancePolicy)
      return errorJson(422, "not-policy", "This doesn't look like a health insurance policy. Upload your policy schedule or policy wording.");
    return json({ ...result, readMs: Date.now() - t0 });
  } catch (e) {
    logAiError("ai/read-policy", e);
    return providerError(e);
  }
}
