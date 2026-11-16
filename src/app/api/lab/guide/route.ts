import { agentGuide } from "@/lib/agent-guide";
import { labBaseUrl } from "@/lib/notify";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return new Response(agentGuide(labBaseUrl(req)), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
