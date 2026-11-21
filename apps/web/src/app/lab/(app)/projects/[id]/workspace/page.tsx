import { ProblemState } from "@/components/ProblemState";
import { Workspace } from "@/components/Workspace";
import { api } from "@/lib/api";
import { attempt } from "@/lib/attempt";
import type { Note, NoteListItem, Project, QueryEngine, SavedQuery } from "@/lib/types";

export const metadata = { title: "Workspace" };

/** Pick the note to open: the one asked for, else the working notes, else the latest. */
function pickNote(notes: NoteListItem[], wanted: string | undefined): NoteListItem | undefined {
  return (
    notes.find((n) => n.id === wanted) ?? notes.find((n) => /working/i.test(n.title)) ?? notes[0] // list is newest first
  );
}

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ note?: string; query?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const res = await attempt(async () => {
    const [project, queries, notes, engine] = await Promise.all([
      api<Project>(`/v1/projects/${id}`),
      api<SavedQuery[]>(`/v1/projects/${id}/queries`),
      api<NoteListItem[]>(`/v1/projects/${id}/notes`),
      api<QueryEngine>("/v1/queries/engine"),
    ]);
    const chosen = pickNote(notes, sp.note);
    const note = chosen ? await api<Note>(`/v1/notes/${chosen.id}`) : null;
    return { project, queries, notes, engine, note };
  });
  if (!res.ok) return <ProblemState problem={res.problem} />;
  const { project, queries, notes, engine, note } = res.data;
  const initialQuery = queries.find((q) => q.id === sp.query)?.id ?? (sp.query === "new" ? null : (queries[0]?.id ?? null));
  return (
    <Workspace
      key={note ? `${note.id}:${note.version}` : "none"}
      project={project}
      queries={queries}
      notes={notes}
      note={note}
      engine={engine}
      initialQueryId={initialQuery}
    />
  );
}
