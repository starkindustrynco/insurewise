import { getAiConfig } from "@/server/ai/config";
import { json } from "@/server/ai/guard";

export const dynamic = "force-dynamic";

/** Tells the browser whether live AI is available. The key itself never leaves the server. */
export function GET() {
  return json(getAiConfig());
}
