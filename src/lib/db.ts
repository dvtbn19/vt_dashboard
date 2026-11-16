import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { SEED_PROJECTS } from "./seed";

export type ProjectStatus = "active" | "paused" | "done" | "idea";
export type ReportStatus = "running" | "done" | "failed" | "draft";
export type CommandStatus = "pending" | "claimed" | "done" | "cancelled";

export type Project = {
  slug: string;
  title: string;
  title_vi: string | null;
  summary: string;
  summary_vi: string | null;
  status: ProjectStatus;
  tags: string[];
  repo_url: string | null;
  demo_url: string | null;
  cover: string | null;
  progress: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type Block =
  | { type: "markdown"; content: string }
  | { type: "metrics"; items: { label: string; value: string | number; delta?: string }[] }
  | { type: "table"; columns: string[]; rows: (string | number | null)[][]; caption?: string }
  | { type: "plotly"; figure: { data: unknown[]; layout?: Record<string, unknown> }; caption?: string }
  | { type: "image"; url: string; caption?: string }
  | { type: "code"; language?: string; content: string }
  | { type: "file"; url: string; name: string }
  | { type: "log"; content: string };

export type Report = {
  id: string;
  project_slug: string;
  title: string;
  summary: string | null;
  agent: string | null;
  status: ReportStatus;
  kind: string | null;
  is_public: boolean;
  blocks: Block[];
  parent_command_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Command = {
  id: string;
  project_slug: string | null;
  report_id: string | null;
  agent: string | null;
  body: string;
  status: CommandStatus;
  response: string | null;
  result_report_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const hasDb = Boolean(url);

let _sql: NeonQueryFunction<false, false> | null = null;
function sql() {
  if (!url) throw new Error("DATABASE_URL is not configured");
  if (!_sql) _sql = neon(url);
  return _sql;
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const q = sql();
      await q`CREATE TABLE IF NOT EXISTS projects (
        slug text PRIMARY KEY,
        title text NOT NULL,
        title_vi text,
        summary text NOT NULL DEFAULT '',
        summary_vi text,
        status text NOT NULL DEFAULT 'active',
        tags text[] NOT NULL DEFAULT '{}',
        repo_url text,
        demo_url text,
        cover text,
        progress int NOT NULL DEFAULT 0,
        is_public boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await q`CREATE TABLE IF NOT EXISTS reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_slug text NOT NULL REFERENCES projects(slug) ON DELETE CASCADE,
        title text NOT NULL,
        summary text,
        agent text,
        status text NOT NULL DEFAULT 'done',
        kind text,
        is_public boolean NOT NULL DEFAULT false,
        blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
        parent_command_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await q`CREATE INDEX IF NOT EXISTS reports_project_idx ON reports(project_slug, created_at DESC)`;
      await q`CREATE TABLE IF NOT EXISTS commands (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_slug text REFERENCES projects(slug) ON DELETE CASCADE,
        report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
        agent text,
        body text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        response text,
        result_report_id uuid,
        created_by text NOT NULL DEFAULT 'owner',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await q`CREATE INDEX IF NOT EXISTS commands_status_idx ON commands(status, created_at)`;
      for (const p of SEED_PROJECTS) {
        await q`INSERT INTO projects (slug, title, title_vi, summary, summary_vi, status, tags, repo_url, demo_url, progress, is_public)
          VALUES (${p.slug}, ${p.title}, ${p.title_vi}, ${p.summary}, ${p.summary_vi}, ${p.status}, ${p.tags}, ${p.repo_url}, ${p.demo_url}, ${p.progress}, ${p.is_public})
          ON CONFLICT (slug) DO NOTHING`;
      }
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

async function db() {
  await ensureSchema();
  return sql();
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

function rowProject(r: Record<string, unknown>): Project {
  return { ...(r as Project), created_at: iso(r.created_at), updated_at: iso(r.updated_at) };
}
function rowReport(r: Record<string, unknown>): Report {
  return { ...(r as Report), created_at: iso(r.created_at), updated_at: iso(r.updated_at) };
}
function rowCommand(r: Record<string, unknown>): Command {
  return { ...(r as Command), created_at: iso(r.created_at), updated_at: iso(r.updated_at) };
}

/* ---------------- projects ---------------- */

export async function listProjects(opts: { includePrivate: boolean }): Promise<Project[]> {
  if (!hasDb) {
    return SEED_PROJECTS.filter((p) => opts.includePrivate || p.is_public);
  }
  const q = await db();
  const rows = opts.includePrivate
    ? await q`SELECT * FROM projects ORDER BY (status = 'active') DESC, updated_at DESC`
    : await q`SELECT * FROM projects WHERE is_public ORDER BY (status = 'active') DESC, updated_at DESC`;
  return rows.map(rowProject);
}

export async function getProject(slug: string): Promise<Project | null> {
  if (!hasDb) return SEED_PROJECTS.find((p) => p.slug === slug) ?? null;
  const q = await db();
  const rows = await q`SELECT * FROM projects WHERE slug = ${slug}`;
  return rows[0] ? rowProject(rows[0]) : null;
}

export type ProjectInput = Partial<Omit<Project, "created_at" | "updated_at">> & { slug: string };

export async function upsertProject(p: ProjectInput): Promise<Project> {
  const q = await db();
  const existing = await getProject(p.slug);
  const m = { ...(existing ?? {}), ...stripUndef(p) } as Project;
  const rows = await q`INSERT INTO projects (slug, title, title_vi, summary, summary_vi, status, tags, repo_url, demo_url, cover, progress, is_public)
    VALUES (${m.slug}, ${m.title ?? m.slug}, ${m.title_vi ?? null}, ${m.summary ?? ""}, ${m.summary_vi ?? null}, ${m.status ?? "active"},
            ${m.tags ?? []}, ${m.repo_url ?? null}, ${m.demo_url ?? null}, ${m.cover ?? null}, ${clampInt(m.progress ?? 0, 0, 100)}, ${m.is_public ?? false})
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title, title_vi = EXCLUDED.title_vi, summary = EXCLUDED.summary, summary_vi = EXCLUDED.summary_vi,
      status = EXCLUDED.status, tags = EXCLUDED.tags, repo_url = EXCLUDED.repo_url, demo_url = EXCLUDED.demo_url,
      cover = EXCLUDED.cover, progress = EXCLUDED.progress, is_public = EXCLUDED.is_public, updated_at = now()
    RETURNING *`;
  return rowProject(rows[0]);
}

export async function touchProject(slug: string) {
  const q = await db();
  await q`UPDATE projects SET updated_at = now() WHERE slug = ${slug}`;
}

/* ---------------- reports ---------------- */

export async function listReports(opts: {
  includePrivate: boolean;
  project?: string;
  limit?: number;
}): Promise<Report[]> {
  if (!hasDb) return [];
  const q = await db();
  const limit = clampInt(opts.limit ?? 50, 1, 200);
  const project = opts.project ?? null;
  const rows = opts.includePrivate
    ? await q`SELECT * FROM reports WHERE (${project}::text IS NULL OR project_slug = ${project})
              ORDER BY created_at DESC LIMIT ${limit}`
    : await q`SELECT r.* FROM reports r JOIN projects p ON p.slug = r.project_slug
              WHERE r.is_public AND p.is_public AND (${project}::text IS NULL OR r.project_slug = ${project})
              ORDER BY r.created_at DESC LIMIT ${limit}`;
  return rows.map(rowReport);
}

export async function getReport(id: string): Promise<Report | null> {
  if (!hasDb || !isUuid(id)) return null;
  const q = await db();
  const rows = await q`SELECT * FROM reports WHERE id = ${id}`;
  return rows[0] ? rowReport(rows[0]) : null;
}

export type ReportInput = {
  project_slug: string;
  title: string;
  summary?: string | null;
  agent?: string | null;
  status?: ReportStatus;
  kind?: string | null;
  is_public?: boolean;
  blocks?: Block[];
  parent_command_id?: string | null;
};

export async function createReport(r: ReportInput): Promise<Report> {
  const q = await db();
  if (!(await getProject(r.project_slug))) {
    await upsertProject({ slug: r.project_slug, title: r.project_slug, status: "active" });
  }
  const rows = await q`INSERT INTO reports (project_slug, title, summary, agent, status, kind, is_public, blocks, parent_command_id)
    VALUES (${r.project_slug}, ${r.title}, ${r.summary ?? null}, ${r.agent ?? null}, ${r.status ?? "done"}, ${r.kind ?? null},
            ${r.is_public ?? false}, ${JSON.stringify(r.blocks ?? [])}::jsonb,
            ${r.parent_command_id && isUuid(r.parent_command_id) ? r.parent_command_id : null})
    RETURNING *`;
  await touchProject(r.project_slug);
  return rowReport(rows[0]);
}

export async function updateReport(
  id: string,
  patch: Partial<Pick<Report, "title" | "summary" | "status" | "is_public" | "kind">> & {
    append_blocks?: Block[];
    blocks?: Block[];
  },
): Promise<Report | null> {
  const cur = await getReport(id);
  if (!cur) return null;
  const q = await db();
  const blocks = patch.blocks ?? [...cur.blocks, ...(patch.append_blocks ?? [])];
  const rows = await q`UPDATE reports SET
      title = ${patch.title ?? cur.title},
      summary = ${patch.summary !== undefined ? patch.summary : cur.summary},
      status = ${patch.status ?? cur.status},
      kind = ${patch.kind !== undefined ? patch.kind : cur.kind},
      is_public = ${patch.is_public ?? cur.is_public},
      blocks = ${JSON.stringify(blocks)}::jsonb,
      updated_at = now()
    WHERE id = ${id} RETURNING *`;
  await touchProject(cur.project_slug);
  return rows[0] ? rowReport(rows[0]) : null;
}

export async function deleteReport(id: string) {
  if (!isUuid(id)) return;
  const q = await db();
  await q`DELETE FROM reports WHERE id = ${id}`;
}

/* ---------------- commands ---------------- */

export async function listCommands(opts: {
  status?: CommandStatus | "open";
  project?: string;
  report?: string;
  agent?: string;
  limit?: number;
}): Promise<Command[]> {
  if (!hasDb) return [];
  const q = await db();
  const status = opts.status ?? null;
  const project = opts.project ?? null;
  const report = opts.report && isUuid(opts.report) ? opts.report : null;
  const agent = opts.agent ?? null;
  const limit = clampInt(opts.limit ?? 100, 1, 500);
  const rows = await q`SELECT * FROM commands
    WHERE (${status}::text IS NULL
           OR (${status} = 'open' AND status IN ('pending','claimed'))
           OR status = ${status})
      AND (${project}::text IS NULL OR project_slug = ${project})
      AND (${report}::uuid IS NULL OR report_id = ${report})
      AND (${agent}::text IS NULL OR agent IS NULL OR agent = ${agent})
    ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(rowCommand);
}

export async function getCommand(id: string): Promise<Command | null> {
  if (!hasDb || !isUuid(id)) return null;
  const q = await db();
  const rows = await q`SELECT * FROM commands WHERE id = ${id}`;
  return rows[0] ? rowCommand(rows[0]) : null;
}

export async function createCommand(c: {
  body: string;
  project_slug?: string | null;
  report_id?: string | null;
  agent?: string | null;
  created_by?: string;
}): Promise<Command> {
  const q = await db();
  let project = c.project_slug ?? null;
  const reportId = c.report_id && isUuid(c.report_id) ? c.report_id : null;
  if (!project && reportId) project = (await getReport(reportId))?.project_slug ?? null;
  const rows = await q`INSERT INTO commands (project_slug, report_id, agent, body, created_by)
    VALUES (${project}, ${reportId}, ${c.agent || null}, ${c.body}, ${c.created_by ?? "owner"}) RETURNING *`;
  return rowCommand(rows[0]);
}

export async function updateCommand(
  id: string,
  patch: { status?: CommandStatus; response?: string | null; result_report_id?: string | null; agent?: string | null },
): Promise<Command | null> {
  const cur = await getCommand(id);
  if (!cur) return null;
  const q = await db();
  const rows = await q`UPDATE commands SET
      status = ${patch.status ?? cur.status},
      response = ${patch.response !== undefined ? patch.response : cur.response},
      result_report_id = ${patch.result_report_id && isUuid(patch.result_report_id) ? patch.result_report_id : cur.result_report_id},
      agent = ${patch.agent !== undefined ? patch.agent : cur.agent},
      updated_at = now()
    WHERE id = ${id} RETURNING *`;
  return rows[0] ? rowCommand(rows[0]) : null;
}

/* ---------------- stats ---------------- */

export async function labStats() {
  if (!hasDb) return { projects: SEED_PROJECTS.length, reports: 0, openCommands: 0, agents: 0 };
  const q = await db();
  const [r] = await q`SELECT
    (SELECT count(*) FROM projects)::int AS projects,
    (SELECT count(*) FROM reports)::int AS reports,
    (SELECT count(*) FROM commands WHERE status IN ('pending','claimed'))::int AS "openCommands",
    (SELECT count(DISTINCT agent) FROM reports WHERE agent IS NOT NULL)::int AS agents`;
  return r as { projects: number; reports: number; openCommands: number; agents: number };
}

/* ---------------- helpers ---------------- */

export function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
function clampInt(n: number, lo: number, hi: number) {
  const v = Math.round(Number(n) || 0);
  return Math.max(lo, Math.min(hi, v));
}
function stripUndef<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
