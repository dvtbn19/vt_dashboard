"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { NoteForm } from "./NoteForm";
import { Notebook } from "./Notebook";
import { createNote } from "@/app/lab/workspace-actions";
import type { Note, Notebook as NotebookData, NoteLink, NoteListItem, Project, QueryEngine, SavedQuery } from "@/lib/types";

type Props = {
  project: Project;
  queries: SavedQuery[];
  notes: NoteListItem[];
  note: Note | null;
  engine: QueryEngine;
  /** null when the API has no notebook table yet (migration 0005). */
  notebook: NotebookData | null;
  initialQueryId: string | null;
};

/** Notebook of SQL cells on the left (each with its own result and chart), the working note on the right; on phones, two tabs. */
export function Workspace({ project, queries: initialQueries, notes, note, engine, notebook, initialQueryId }: Props) {
  const router = useRouter();
  const [queries, setQueries] = useState(initialQueries);
  const [currentId, setCurrentId] = useState<string | null>(initialQueryId);
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

  const focusCell = useCallback(
    (id: string | null) => {
      if (id !== currentId) {
        setCurrentId(id);
        setAddress(id);
      }
    },
    [currentId, setAddress],
  );

  /** Jump to a query's cell (from the note, or the cell list). */
  const openQuery = useCallback(
    (id: string | null) => {
      setTab("sql");
      if (!id) return;
      focusCell(id);
      requestAnimationFrame(() => document.getElementById(`cell-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    },
    [focusCell],
  );

  const onSaved = useCallback(
    (q: SavedQuery, isNew: boolean) => {
      setQueries((qs) => (isNew ? [...qs, q] : qs.map((x) => (x.id === q.id ? q : x))).sort((a, b) => a.name.localeCompare(b.name)));
      if (isNew) focusCell(q.id);
    },
    [focusCell],
  );

  const onDeleted = useCallback(
    (id: string) => {
      setQueries((qs) => qs.filter((q) => q.id !== id));
      if (currentId === id) focusCell(null);
    },
    [currentId, focusCell],
  );

  const usedInFor = useCallback(
    (queryId: string) => {
      const out: { noteId: string; noteTitle: string; section: string }[] = [];
      for (const n of notes) {
        const links = note && n.id === note.id ? noteLinks : n.links;
        for (const l of links ?? []) if (l.query_id === queryId) out.push({ noteId: n.id, noteTitle: n.title, section: l.section });
      }
      return out;
    },
    [notes, note, noteLinks],
  );

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
          <Notebook
            projectId={project.id}
            queries={queries}
            engine={engine}
            notebook={notebook}
            currentId={currentId}
            initialQueryId={initialQueryId}
            onQuerySaved={onSaved}
            onQueryDeleted={onDeleted}
            onFocusQuery={focusCell}
            asideFor={(queryId) => {
              const used = usedInFor(queryId);
              if (!used.length) return null;
              return (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="text-muted">Used in</span>
                  {used.map((u, j) =>
                    note && u.noteId === note.id ? (
                      <button
                        key={j}
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
                      <Link key={j} href={`/lab/projects/${project.id}/workspace?note=${u.noteId}&query=${queryId}`} className="rounded-full bg-sunken px-2.5 py-1 hover:text-accent">
                        {u.noteTitle}
                        {u.section ? ` › ${u.section}` : ""}
                      </Link>
                    ),
                  )}
                </div>
              );
            }}
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
