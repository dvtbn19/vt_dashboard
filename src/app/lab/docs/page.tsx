import { headers } from "next/headers";
import { agentGuide } from "@/lib/agent-guide";
import { Markdown } from "@/components/Blocks";

export default async function Docs() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "lab.vtcons.com";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = process.env.LAB_PUBLIC_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;
  return (
    <div className="mx-auto max-w-3xl">
      <p className="label mb-4">
        raw markdown: <a className="text-lime" href="/api/lab/guide">/api/lab/guide</a>
      </p>
      <div className="card overflow-x-auto p-6">
        <Markdown content={agentGuide(base)} />
      </div>
    </div>
  );
}
