import "server-only";
import { api, ApiError } from "./api";
import type { Artifact, ArtifactPreview, DashboardPin, RunDetail, RunListItem } from "./types";

export type LoadedPreview = { ok: true; preview: ArtifactPreview } | { ok: false; error: string };

export type RunDashboardData = {
  /** Completed runs with files, newest first: the choices for the dashboard's source. */
  runs: RunListItem[];
  /** The pinned run, or null; `pinSupported` is false until migration 0006 is applied. */
  pinned: string | null;
  pinSupported: boolean;
  run: RunDetail | null;
  previews: Record<string, LoadedPreview>;
};

function isNextControl(err: unknown) {
  const digest = (err as { digest?: unknown })?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

async function preview(a: Artifact): Promise<LoadedPreview> {
  try {
    return { ok: true, preview: await api<ArtifactPreview>(`/v1/artifacts/${a.id}/preview`) };
  } catch (err) {
    if (isNextControl(err)) throw err;
    return { ok: false, error: err instanceof ApiError ? err.detail : "Preview unavailable" };
  }
}

const hasChart = (r: RunDetail) => r.artifacts.some((a) => a.kind === "plotly" && a.status === "ready");

/**
 * The run a project's dashboard shows: the one asked for, else the pinned one, else the latest
 * completed run with a chart. Previews of all its files are loaded here, in parallel.
 */
export async function loadRunDashboard(projectId: string, wanted?: string): Promise<RunDashboardData> {
  const [list, pin] = await Promise.all([
    api<RunListItem[]>(`/v1/projects/${projectId}/runs?limit=50`),
    api<DashboardPin>(`/v1/projects/${projectId}/dashboard`).then(
      (p) => ({ ok: true as const, run_id: p.run_id }),
      (err: unknown) => {
        if (isNextControl(err)) throw err;
        return { ok: false as const, run_id: null };
      },
    ),
  ]);
  const runs = list.filter((r) => r.status === "completed" && r.artifact_count > 0);

  let run: RunDetail | null = null;
  for (const id of [wanted, pin.run_id]) {
    if (!id || run) continue;
    if (!list.some((r) => r.id === id)) continue; // not in this project (or older than the list)
    run = await api<RunDetail>(`/v1/runs/${id}`);
  }
  if (!run) {
    // Newest completed run with a chart; look at a few at a time.
    for (let i = 0; i < Math.min(runs.length, 12) && !run; i += 4) {
      const batch = await Promise.all(runs.slice(i, i + 4).map((r) => api<RunDetail>(`/v1/runs/${r.id}`)));
      run = batch.find(hasChart) ?? null;
    }
  }
  const previews: Record<string, LoadedPreview> = {};
  if (run) {
    const ready = run.artifacts.filter((a) => a.status === "ready");
    const loaded = await Promise.all(ready.map(preview));
    ready.forEach((a, i) => (previews[a.id] = loaded[i]));
  }
  return { runs, pinned: pin.run_id, pinSupported: pin.ok, run, previews };
}
