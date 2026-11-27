export type ProjectStatus = "idea" | "active" | "paused" | "completed" | "archived";
export type Visibility = "private" | "public";
export type RunStatus = "running" | "completed" | "failed";

export type Project = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  status: ProjectStatus;
  visibility: Visibility;
  tags: string[];
  repo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectListItem = Project & {
  run_count: number;
  last_run_at: string | null;
  last_run_status: RunStatus | null;
};

export type PublicProject = Pick<
  Project,
  "slug" | "name" | "summary" | "description" | "category" | "status" | "tags" | "repo_url" | "updated_at"
>;

export type Run = {
  id: string;
  project_id: string;
  name: string;
  status: RunStatus;
  source: string;
  params: Record<string, unknown>;
  tags: string[];
  git_commit: string | null;
  dataset_version: string | null;
  notes: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  created_by: string | null;
};

export type RunListItem = Run & { metric_count: number; artifact_count: number };

export type Metric = { key: string; value: number; step: number | null; recorded_at: string };

export type Artifact = {
  id: string;
  run_id: string;
  name: string;
  kind: "image" | "csv" | "markdown" | "plotly";
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string | null;
  status: "pending_upload" | "ready" | "failed";
  description: string | null;
  failure_reason: string | null;
  created_at: string;
  finalized_at: string | null;
};

export type RunDetail = Run & { project: Project; metrics: Metric[]; artifacts: Artifact[] };

export type ArtifactPreview = {
  kind: string;
  truncated: boolean;
  columns?: string[] | null;
  rows?: string[][] | null;
  text?: string | null;
  figure?: { data: unknown[]; layout: Record<string, unknown> } | null;
  url?: string | null;
};

export type Credential = {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  project_ids: string[];
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type Overview = {
  project_count: number;
  run_count: number;
  running_count: number;
  failed_count: number;
  artifact_count: number;
  recent_runs: RunListItem[];
  project_names: Record<string, string>;
};

export const CATEGORIES: { value: string; label: string }[] = [
  { value: "eda", label: "EDA" },
  { value: "data-engineering", label: "Data engineering" },
  { value: "data-science", label: "Data science" },
  { value: "ml", label: "Machine learning" },
  { value: "deep-learning", label: "Deep learning" },
  { value: "ai-agent", label: "AI agent" },
  { value: "other", label: "Other" },
];

export const PROJECT_STATUSES: ProjectStatus[] = ["idea", "active", "paused", "completed", "archived"];

export function categoryLabel(v: string): string {
  return CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

export type NoteLink = { query_id: string; section: string };

export type NoteListItem = {
  id: string;
  project_id: string;
  title: string;
  links: NoteLink[];
  version: number;
  last_edited_by: string;
  created_at: string;
  updated_at: string;
};
export type Note = NoteListItem & { body: string };

export type ChartType = "bar" | "hbar" | "line" | "area" | "scatter";
export type ChartAgg = "sum" | "avg" | "min" | "max" | "count" | "none";
export type FilterValue = string | number | boolean | null;
export type ChartFilter = { column: string; values: FilterValue[] };
/** A saved chart. Fields after `y` are optional so older specs ({type, x, y}) keep working. */
export type ChartSpec = {
  type: ChartType;
  x: string;
  y: string[];
  /** How rows sharing an X value combine; absent = "none" (every row is a point, the original behaviour). */
  agg?: ChartAgg;
  /** Dimension whose values get one colour each (Tableau's Color shelf). */
  color?: string | null;
  /** One small chart per value of this column, or "@measures" for one per measure. */
  facet?: string | null;
  barmode?: "group" | "stack" | "percent";
  sort?: "none" | "desc" | "asc";
  /** Keep only rows whose column value is in `values`. */
  filters?: ChartFilter[];
};

export type SavedQueryListItem = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  version: number;
  last_edited_by: string;
  created_at: string;
  updated_at: string;
};
export type SavedQuery = SavedQueryListItem & { sql: string; chart: ChartSpec | null };

export type Cell = string | number | boolean | null | Cell[] | { [k: string]: Cell };
export type QueryResult = { columns: string[]; rows: Cell[][]; row_count: number; truncated: boolean; elapsed_ms: number };
export type QueryEngine = { configured: boolean; timeout_seconds: number; max_rows: number };

/** Workspace notebook: the order of SQL cells (saved queries) and Markdown cells. */
export type NotebookCell = { type: "sql"; query_id: string } | { type: "markdown"; id: string; text: string };
export type Notebook = { project_id: string; cells: NotebookCell[]; version: number; last_edited_by: string; updated_at: string | null };

/** Which run a project's dashboard shows; null means the latest completed run with a chart. */
export type DashboardPin = {
  project_id: string;
  run_id: string | null;
  is_public: boolean;
  published_at: string | null;
  updated_by: string;
  updated_at: string | null;
};

/** A dashboard its owner published: what anyone can read at /dashboards/<slug>. */
export type PublicDashboard = {
  project: { slug: string; name: string; category: string };
  run: { name: string; status: RunStatus; params: Record<string, unknown>; tags: string[]; started_at: string; finished_at: string | null };
  metrics: Metric[];
  artifacts: { id: string; name: string; kind: Artifact["kind"]; description: string | null; preview: ArtifactPreview | null; error: string | null }[];
  published_at: string | null;
};
