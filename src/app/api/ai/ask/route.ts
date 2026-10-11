import { getAiConfig, getLanguageModel } from "@/server/ai/config";
import { clientKey, errorJson, json, logAiError, providerError, rateLimited, readBody } from "@/server/ai/guard";
import { askPolicy, askRequestSchema } from "@/server/ai/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 75;

/** Answers a question about the family's policy from the pages the browser picked. */
export async function POST(req: Request) {
  const cfg = getAiConfig();
  if (!cfg.live) return errorJson(503, "ai-off", cfg.reason ?? "Live AI is not configured.");
  if (rateLimited(clientKey(req))) return errorJson(429, "rate-limited", "Too many AI requests. Wait a minute and try again.");
  const body = await readBody(req, askRequestSchema, 200_000);
  if (!body.ok) return body.res;
  try {
    return json(await askPolicy(getLanguageModel(), cfg.model, body.data));
  } catch (e) {
    logAiError("ai/ask", e);
    return providerError(e);
  }
}
