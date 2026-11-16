import { createReport, getProject, listReports, updateCommand, type ReportStatus } from "@/lib/db";
import { isAuthorizedRequest } from "@/lib/auth";
import { normalizeBlocks } from "@/lib/blocks";
import { body, err, guard, handle, json } from "@/lib/api";
import { labBaseUrl, notifyTelegram } from "@/lib/notify";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const u = new URL(req.url);
    const reports = await listReports({
      includePrivate: isAuthorizedRequest(req),
      project: u.searchParams.get("project") ?? undefined,
      limit: Number(u.searchParams.get("limit") ?? 50),
    });
    // keep list payloads light
    return json({ reports: reports.map(({ blocks, ...r }) => ({ ...r, block_count: blocks.length })) });
  });
}

type Body = {
  project: string;
  title: string;
  summary?: string;
  agent?: string;
  status?: ReportStatus;
  kind?: string;
  is_public?: boolean;
  blocks?: unknown;
  command_id?: string;
  notify?: boolean;
};

export function POST(req: Request) {
  return handle(async () => {
    const g = guard(req);
    if (g) return g;
    const b = await body<Body>(req);
    const project = b.project ?? (b as unknown as { project_slug?: string }).project_slug;
    if (!project || !b.title) return err("`project` and `title` are required");
    const proj = await getProject(project);
    const report = await createReport({
      project_slug: project,
      title: b.title,
      summary: b.summary,
      agent: b.agent,
      status: b.status ?? "done",
      kind: b.kind,
      is_public: b.is_public ?? false,
      blocks: await normalizeBlocks(b.blocks),
      parent_command_id: b.command_id,
    });
    if (b.command_id) {
      await updateCommand(b.command_id, { status: report.status === "running" ? "claimed" : "done", result_report_id: report.id });
    }
    const url = `${labBaseUrl(req)}/lab/r/${report.id}`;
    if (b.notify !== false) {
      const icon = report.status === "failed" ? "🔴" : report.status === "running" ? "🟡" : "🟢";
      await notifyTelegram(
        `${icon} ${report.agent ?? "agent"} → ${proj?.title ?? project}\n${report.title}${report.summary ? `\n\n${report.summary.slice(0, 500)}` : ""}\n\n${url}`,
      );
    }
    return json({ report: { id: report.id, url, status: report.status } }, 201);
  });
}
