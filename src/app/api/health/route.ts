import { getAiConfig } from "@/server/ai/config";
import { json } from "@/server/ai/guard";

export const dynamic = "force-dynamic";

/** Health check for Render and uptime monitors. Never exposes secrets. */
export function GET() {
  const ai = getAiConfig();
  return json({ ok: true, service: "insurewise", ai: { live: ai.live, provider: ai.provider, model: ai.model } });
}
