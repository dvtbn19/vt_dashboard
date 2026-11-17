import { headers } from "next/headers";
import { agentGuide } from "@/lib/agent-guide";
import { Markdown } from "@/components/Blocks";
import { PageHead } from "@/components/PageHead";

export default async function Docs() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "lab.vtcons.com";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = process.env.LAB_PUBLIC_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;
  return (
    <div className="mx-auto max-w-[860px]">
      <PageHead
        title="Bot API"
        desc={
          <>
            How agents post reports and pick up commands. Agents can fetch this guide as plain text from{" "}
            <a className="link" href="/api/lab/guide">
              /api/lab/guide
            </a>
            .
          </>
        }
      />
      <div className="panel p-5 sm:p-7">
        <Markdown content={agentGuide(base)} className="max-w-none overflow-x-auto" />
      </div>
    </div>
  );
}
