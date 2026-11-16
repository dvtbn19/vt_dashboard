import { listProjects, upsertProject, type ProjectInput } from "@/lib/db";
import { isAuthorizedRequest } from "@/lib/auth";
import { body, err, guard, handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => json({ projects: await listProjects({ includePrivate: isAuthorizedRequest(req) }) }));
}

/** Create or update a project (upsert by slug). */
export function POST(req: Request) {
  return handle(async () => {
    const g = guard(req);
    if (g) return g;
    const b = await body<ProjectInput>(req);
    if (!b.slug || !/^[a-z0-9][a-z0-9-]{1,60}$/.test(b.slug)) return err("slug must be lowercase letters, digits and dashes");
    return json({ project: await upsertProject(b) });
  });
}
