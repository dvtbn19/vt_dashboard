import "server-only";
import { api } from "./api";
import type { Metric, Note, NoteListItem, Project, QueryEngine, RunDetail, RunListItem, SavedQuery } from "./types";

export type PresentationData = {
  project: Project;
  notes: NoteListItem[];
  note: Note | null;
  queries: SavedQuery[];
  engine: QueryEngine;
  metrics: Metric[];
  metricsRun: { id: string; name: string; finished_at: string | null } | null;
};

function soft<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch((err: unknown) => {
    const digest = (err as { digest?: unknown })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_")) throw err; // redirects (expired session)
    return fallback;
  });
}

/** Everything the stakeholder dashboard needs. Notes/queries failing must not hide the rest. */
export async function loadPresentation(projectId: string, noteId?: string): Promise<PresentationData> {
  const [project, runs, notes, queries, engine] = await Promise.all([
    api<Project>(`/v1/projects/${projectId}`),
    api<RunListItem[]>(`/v1/projects/${projectId}/runs?limit=20`),
    soft(api<NoteListItem[]>(`/v1/projects/${projectId}/notes`), [] as NoteListItem[]),
    soft(api<SavedQuery[]>(`/v1/projects/${projectId}/queries`), [] as SavedQuery[]),
    api<QueryEngine>("/v1/queries/engine"),
  ]);
  const chosen = notes.find((n) => n.id === noteId) ?? notes.find((n) => /working/i.test(n.title)) ?? notes[0];
  const latest = runs.find((r) => r.status === "completed" && r.metric_count > 0);
  const [note, run] = await Promise.all([
    chosen ? api<Note>(`/v1/notes/${chosen.id}`) : Promise.resolve(null),
    latest ? api<RunDetail>(`/v1/runs/${latest.id}`) : Promise.resolve(null),
  ]);
  return {
    project,
    notes,
    note,
    queries,
    engine,
    metrics: run?.metrics ?? [],
    metricsRun: run ? { id: run.id, name: run.name, finished_at: run.finished_at } : null,
  };
}
