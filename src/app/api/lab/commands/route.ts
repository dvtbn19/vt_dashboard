import { createCommand, listCommands, type CommandStatus } from "@/lib/db";
import { body, err, guard, handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Agents poll this for work: GET /api/lab/commands?status=pending&agent=<name>&project=<slug>
 * Commands with no agent are visible to every agent.
 */
export function GET(req: Request) {
  return handle(async () => {
    const g = guard(req);
    if (g) return g;
    const u = new URL(req.url);
    const commands = await listCommands({
      status: (u.searchParams.get("status") as CommandStatus | "open" | null) ?? "pending",
      agent: u.searchParams.get("agent") ?? undefined,
      project: u.searchParams.get("project") ?? undefined,
      report: u.searchParams.get("report") ?? undefined,
      limit: Number(u.searchParams.get("limit") ?? 50),
    });
    return json({ commands: commands.reverse() }); // oldest first = work queue order
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const g = guard(req);
    if (g) return g;
    const b = await body<{ body: string; project?: string; report_id?: string; agent?: string; created_by?: string }>(req);
    if (!b.body?.trim()) return err("`body` is required");
    const c = await createCommand({
      body: b.body.trim(),
      project_slug: b.project,
      report_id: b.report_id,
      agent: b.agent,
      created_by: b.created_by ?? "api",
    });
    return json({ command: c }, 201);
  });
}
