import { getCommand, updateCommand, type CommandStatus } from "@/lib/db";
import { body, err, guard, handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export function GET(req: Request, ctx: RouteContext<"/api/lab/commands/[id]">) {
  return handle(async () => {
    const g = guard(req);
    if (g) return g;
    const c = await getCommand((await ctx.params).id);
    return c ? json({ command: c }) : err("Not found", 404);
  });
}

/** Claim / finish a command: { status: "claimed" | "done" | "cancelled", response?, result_report_id?, agent? } */
export function PATCH(req: Request, ctx: RouteContext<"/api/lab/commands/[id]">) {
  return handle(async () => {
    const g = guard(req);
    if (g) return g;
    const b = await body<{ status?: CommandStatus; response?: string; result_report_id?: string; agent?: string }>(req);
    if (b.status && !["pending", "claimed", "done", "cancelled"].includes(b.status)) return err("invalid status");
    const c = await updateCommand((await ctx.params).id, b);
    return c ? json({ command: c }) : err("Not found", 404);
  });
}
