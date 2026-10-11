import { getAiConfig, getLanguageModel } from "@/server/ai/config";
import { clientKey, errorJson, json, logAiError, providerError, rateLimited, readBody } from "@/server/ai/guard";
import { decodeLetter, decodeRequestSchema } from "@/server/ai/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 100;

/** Decodes a claim letter or hospital bill against the family's policy. */
export async function POST(req: Request) {
  const cfg = getAiConfig();
  if (!cfg.live) return errorJson(503, "ai-off", cfg.reason ?? "Live AI is not configured.");
  if (rateLimited(clientKey(req))) return errorJson(429, "rate-limited", "Too many AI requests. Wait a minute and try again.");
  const body = await readBody(req, decodeRequestSchema, 10_000_000);
  if (!body.ok) return body.res;
  if (!body.data.text && !body.data.file) return errorJson(400, "empty", "Add a letter or bill to decode.");
  try {
    const r = await decodeLetter(getLanguageModel(), cfg.model, body.data);
    if (!r.isClaimDocument)
      return errorJson(
        422,
        "not-claim",
        "This doesn't look like a claim letter or hospital bill. Upload the letter from your insurer, TPA or hospital.",
      );
    return json(r);
  } catch (e) {
    logAiError("ai/decode", e);
    return providerError(e);
  }
}
