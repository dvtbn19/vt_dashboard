import { deleteReport, getProject, getReport, updateReport, type ReportStatus } from "@/lib/db";
import { isAuthorizedRequest } from "@/lib/auth";
import { normalizeBlocks } from "@/lib/blocks";
import { body, err, guard, handle, json } from "@/lib/api";
import { labBaseUrl, notifyTelegram } from "@/lib/notify";

export const dynamic = "force-dynamic";

export function GET(req: Request, ctx: RouteContext<"/api/lab/reports/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const r = await getReport(id);
    if (!r) return err("Not found", 404);
    if (!isAuthorizedRequest(req)) {
      const p = await getProject(r.project_slug);
      if (!r.is_public || !p?.is_public) return err("Not found", 404);
    }
    return json({ report: r });
  });
}

type Patch = {
  title?: string;
  summary?: string;
  status?: ReportStatus;
  kind?: string;
  is_public?: boolean;
  blocks?: unknown;
  append_blocks?: unknown;
};

/** Update a report. Use `append_blocks` to stream progress (e.g. epochs) into a running report. */
export function PATCH(req: Request, ctx: RouteContext<"/api/lab/reports/[id]">) {
  return handle(async () => {
    const g = guard(req);
    if (g) return g;
    const { id } = await ctx.params;
    const b = await body<Patch>(req);
    const before = await getReport(id);
    if (!before) return err("Not found", 404);
    const r = await updateReport(id, {
      title: b.title,
      summary: b.summary,
      status: b.status,
      kind: b.kind,
      is_public: b.is_public,
      blocks: b.blocks !== undefined ? await normalizeBlocks(b.blocks) : undefined,
      append_blocks: b.append_blocks !== undefined ? await normalizeBlocks(b.append_blocks) : undefined,
    });
    if (r && before.status === "running" && r.status !== "running") {
      const icon = r.status === "failed" ? "🔴" : "🟢";
      await notifyTelegram(`${icon} ${r.agent ?? "agent"} finished: ${r.title} (${r.status})\n\n${labBaseUrl(req)}/lab/r/${r.id}`);
    }
    return json({ report: r });
  });
}

export function DELETE(req: Request, ctx: RouteContext<"/api/lab/reports/[id]">) {
  return handle(async () => {
    const g = guard(req);
    if (g) return g;
    const { id } = await ctx.params;
    await deleteReport(id);
    return json({ ok: true });
  });
}
