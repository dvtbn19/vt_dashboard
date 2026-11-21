"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { NoteForm } from "./NoteForm";
import { QueryEditor } from "./QueryEditor";
import { createNote } from "@/app/lab/workspace-actions";
import type { Note, NoteLink, NoteListItem, Project, QueryEngine, SavedQuery } from "@/lib/types";

type Props = {
  project: Project;
  queries: SavedQuery[];
  notes: NoteListItem[];
  note: Note | null;
  engine: QueryEngine;
  initialQueryId: string | null;
};

/** SQL on the left, the working note on the right; on phones, two tabs. */
export function Workspace({ project, queries: initialQueries, notes, note, engine, initialQueryId }: Props) {
  const router = useRouter();
  const [queries, setQueries] = useState(initialQueries);
  const [currentId, setCurrentId] = useState<string | null>(initialQueryId);
  const [editorKey, setEditorKey] = useState(0);
  const [queryDirty, setQueryDirty] = useState(false);
  const [noteLinks, setNoteLinks] = useState<NoteLink[]>(note?.links ?? []);
  const [tab, setTab] = useState<"sql" | "note">("sql");

  const current = queries.find((q) => q.id === currentId) ?? null;

  const setAddress = useCallback(
    (queryId: string | null) => {
      const p = new URLSearchParams();
      if (note) p.set("note", note.id);
      p.set("query", queryId ?? "new");
      window.history.replaceState(null, "", `/lab/projects/${project.id}/workspace?${p}`);
    },
    [note, project.id],
  );

  const openQuery = useCallback(
    (id: string | null) => {
      if (id === currentId && id !== null) {
        setTab("sql");
        return;
      }
      if (queryDirty && !window.confirm("Discard your unsaved SQL changes?")) return;
      setCurrentId(id);
      setEditorKey((k) => k + 1);
      setQueryDirty(false);
      setTab("sql");
      setAddress(id);
    },
    [currentId, queryDirty, setAddress],
  );

  const onSaved = useCallback(
    (q: SavedQuery, isNew: boolean) => {
      setQueries((qs) => (isNew ? [...qs, q] : qs.map((x) => (x.id === q.id ? q : x))).sort((a, b) => a.name.localeCompare(b.name)));
      if (isNew) {
        setCurrentId(q.id);
        setAddress(q.id);
      }
    },
    [setAddress],
  );

  // Where the open query is used: other notes (as saved) plus this note (live).
  const usedIn = useMemo(() => {
    if (!currentId) return [];
    const out: { noteId: string; noteTitle: string; section: string }[] = [];
    for (const n of notes) {
      const links = note && n.id === note.id ? noteLinks : n.links;
      for (const l of links ?? []) if (l.query_id === currentId) out.push({ noteId: n.id, noteTitle: n.title, section: l.section });
    }
    return out;
  }, [currentId, notes, note, noteLinks]);

  const newNote = createNote.bind(null, project.id);

  return (
    <div className="lg:-mt-4">
      {/* top bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <nav aria-label="Breadcrumb" className="min-w-0 text-[14px] text-muted">
          <Link href={`/lab/projects/${project.id}`} className="hover:text-ink">
            {project.name}
          </Link>{" "}
          / <span className="font-semibold text-ink">Workspace</span>
        </nav>
        <div className="flex items-center gap-2">
          <Link href={`/lab/projects/${project.id}/dashboard`} className="btn btn-quiet !min-h-9 !px-3 text-[14px]">
            Dashboard
          </Link>
        </div>
      </div>

      {/* phone tabs */}
      <div role="tablist" aria-label="Workspace panel" className="sticky top-14 z-20 -mx-4 mt-3 flex border-b border-line bg-bg/95 px-4 backdrop-blur lg:hidden">
        {(["sql", "note"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 flex-1 border-b-2 text-[15px] ${tab === t ? "border-accent font-semibold" : "border-transparent text-muted"}`}
          >
            {t === "sql" ? "SQL" : "Note"}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-6 lg:grid-cols-2 lg:gap-0">
        {/* ------------------------------------------------ SQL */}
        <section
          aria-label="SQL"
          className={`${tab === "sql" ? "" : "hidden"} min-w-0 lg:block lg:h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:border-r lg:border-line lg:pr-6`}
        >
          <div className="sticky top-[100px] z-10 flex flex-wrap items-center gap-2 bg-bg/95 pb-3 pt-1 backdrop-blur lg:top-0">
            <label htmlFor="pick-query" className="sr-only">
              Open a saved query
            </label>
            <select
              id="pick-query"
              className="field !min-h-10 min-w-0 flex-1 !py-1.5 text-[15px]"
              value={currentId ?? ""}
              onChange={(e) => openQuery(e.target.value || null)}
            >
              {currentId === null && <option value="">New query (unsaved)</option>}
              {queries.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                  {q.chart ? "  · chart" : ""}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-quiet !min-h-10 !px-3 text-[14px]" onClick={() => openQuery(null)}>
              New
            </button>
          </div>
          <QueryEditor
            key={editorKey}
            projectId={project.id}
            query={current}
            engine={engine}
            onSaved={onSaved}
            onDirtyChange={setQueryDirty}
            compact
            aside={
              currentId && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="text-muted">Used in</span>
                  {usedIn.length === 0 ? (
                    <span className="text-muted">no note yet: link it from a note section →</span>
                  ) : (
                    usedIn.map((u, i) =>
                      note && u.noteId === note.id ? (
                        <button
                          key={i}
                          type="button"
                          className="rounded-full bg-sunken px-2.5 py-1 hover:text-accent"
                          onClick={() => {
                            setTab("note");
                            document.querySelector(`[aria-label="${CSS.escape(u.section)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                        >
                          {u.section || u.noteTitle}
                        </button>
                      ) : (
                        <Link key={i} href={`/lab/projects/${project.id}/workspace?note=${u.noteId}&query=${currentId}`} className="rounded-full bg-sunken px-2.5 py-1 hover:text-accent">
                          {u.noteTitle}
                          {u.section ? ` › ${u.section}` : ""}
                        </Link>
                      ),
                    )
                  )}
                </div>
              )
            }
          />
        </section>

        {/* ------------------------------------------------ note */}
        <section
          aria-label="Note"
          className={`${tab === "note" ? "" : "hidden"} min-w-0 lg:block lg:h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pl-6`}
        >
          {notes.length > 1 && note && (
            <div className="mb-2 flex items-center gap-2 pt-1">
              <label htmlFor="pick-note" className="shrink-0 text-[13px] text-muted">
                Note
              </label>
              <select
                id="pick-note"
                className="field !min-h-9 min-w-0 flex-1 !py-1 text-[14px]"
                value={note.id}
                onChange={(e) => router.push(`/lab/projects/${project.id}/workspace?note=${e.target.value}&query=${currentId ?? "new"}`)}
              >
                {notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          {note ? (
            <NoteForm
              note={note}
              queries={queries}
              currentQuery={current ? { id: current.id, name: current.name } : null}
              onOpenQuery={(id) => openQuery(id)}
              onLinksChange={setNoteLinks}
              compact
            />
          ) : (
            <div className="sheet mt-1 p-5">
              <p className="font-semibold">No notes yet</p>
              <p className="mt-1 text-[15px] text-muted">
                Start working notes: eight short sections (request, questions, data checks, decisions, hypotheses, findings,
                recommendations, expected questions) you fill in as you go, each linked to the SQL behind it.
              </p>
              <form action={newNote} className="mt-4 flex flex-wrap gap-2">
                <input type="hidden" name="query" value={currentId ?? ""} />
                <button type="submit" name="template" value="working" className="btn">
                  Start working notes
                </button>
                <button type="submit" name="template" value="blank" className="btn btn-quiet">
                  Blank note
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
