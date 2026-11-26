"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NoteForm } from "./NoteForm";
import { QueryEditor, type QueryFields } from "./QueryEditor";
import { createNote, removeQuery } from "@/app/lab/workspace-actions";
import type { Note, NoteLink, NoteListItem, Project, QueryEngine, SavedQuery } from "@/lib/types";

type Props = {
  project: Project;
  queries: SavedQuery[];
  notes: NoteListItem[];
  note: Note | null;
  engine: QueryEngine;
  initialQueryId: string | null;
};

/** One notebook cell: a saved query, or a new one not saved yet. */
type Cell = { key: string; queryId: string | null; draftId: string; initial?: QueryFields; autoFocus?: boolean };

const DRAFT_PREFIX = "vtlab:query-draft:";

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Notebook of SQL cells on the left (each with its own result and chart), the working note on the right; on phones, two tabs. */
export function Workspace({ project, queries: initialQueries, notes, note, engine, initialQueryId }: Props) {
  const router = useRouter();
  const [queries, setQueries] = useState(initialQueries);
  // Cells in the order the queries were created; new cells go at the bottom.
  const [cells, setCells] = useState<Cell[]>(() =>
    [...initialQueries]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((q) => ({ key: q.id, queryId: q.id, draftId: q.id })),
  );
  const [currentId, setCurrentId] = useState<string | null>(initialQueryId);
  const [runAllSignal, setRunAllSignal] = useState(0);
  const [noteLinks, setNoteLinks] = useState<NoteLink[]>(note?.links ?? []);
  const [tab, setTab] = useState<"sql" | "note">("sql");

  const current = queries.find((q) => q.id === currentId) ?? null;
  const byId = useMemo(() => new Map(queries.map((q) => [q.id, q])), [queries]);

  // New cells that were never saved come back from this browser after a reload.
  useEffect(() => {
    const restored: Cell[] = [];
    try {
      const prefix = `${DRAFT_PREFIX}${project.id}:`;
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k?.startsWith(prefix)) continue;
        const draftId = k.slice(prefix.length);
        if (draftId === "new" || draftId.startsWith("new-")) restored.push({ key: draftId, queryId: null, draftId });
      }
    } catch {
      /* storage unavailable */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after mount
    if (restored.length) setCells((cs) => [...cs, ...restored]);
  }, [project.id]);

  // Opened from a link to one query: bring its cell into view.
  useEffect(() => {
    if (!initialQueryId) return;
    document.getElementById(`cell-${initialQueryId}`)?.scrollIntoView({ block: "start" });
  }, [initialQueryId]);

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

  const addCell = useCallback(
    (initial?: QueryFields, after?: string) => {
      const used = new Set([...queries.map((q) => q.name.trim().toLowerCase()), ...cells.map((c) => c.initial?.name.trim().toLowerCase())]);
      let n = cells.length + 1;
      while (used.has(`query ${n}`)) n++;
      let name = initial?.name ?? `Query ${n}`;
      for (let i = 2; used.has(name.trim().toLowerCase()); i++) name = `${initial?.name ?? "Query"} ${i}`;
      const key = `new-${newKey()}`;
      const cell: Cell = { key, queryId: null, draftId: key, initial: { description: "", sql: "select current_date as today", chart: null, ...initial, name }, autoFocus: true };
      setCells((cs) => {
        const at = after ? cs.findIndex((c) => c.key === after) : -1;
        return at === -1 ? [...cs, cell] : [...cs.slice(0, at + 1), cell, ...cs.slice(at + 1)];
      });
      setTab("sql");
      requestAnimationFrame(() => document.getElementById(`cell-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    },
    [queries, cells],
  );

  const onSaved = useCallback(
    (cellKey: string, q: SavedQuery, isNew: boolean) => {
      setQueries((qs) => (isNew ? [...qs, q] : qs.map((x) => (x.id === q.id ? q : x))).sort((a, b) => a.name.localeCompare(b.name)));
      if (isNew) {
        // Keep the cell (and its editor state); just remember which query it now is.
        setCells((cs) => cs.map((c) => (c.key === cellKey ? { ...c, queryId: q.id } : c)));
        focusCell(q.id);
      }
    },
    [focusCell],
  );

  const deleteCell = useCallback(
    async (cellKey: string, queryId: string | null): Promise<string | null> => {
      if (queryId) {
        const res = await removeQuery(queryId, project.id);
        if (!res.ok) return res.error;
        setQueries((qs) => qs.filter((q) => q.id !== queryId));
        if (currentId === queryId) focusCell(null);
      }
      setCells((cs) => cs.filter((c) => c.key !== cellKey));
      return null;
    },
    [project.id, currentId, focusCell],
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
          <div className="sticky top-[100px] z-10 flex flex-wrap items-center gap-2 bg-bg/95 pb-3 pt-1 backdrop-blur lg:top-0">
            <label htmlFor="jump-cell" className="sr-only">
              Go to a cell
            </label>
            <select
              id="jump-cell"
              className="field !min-h-10 min-w-0 flex-1 !py-1.5 text-[15px]"
              value=""
              onChange={(e) => {
                const k = e.target.value;
                if (k) document.getElementById(`cell-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <option value="">
                {cells.length} cell{cells.length === 1 ? "" : "s"} · go to…
              </option>
              {cells.map((c, i) => {
                const q = c.queryId ? byId.get(c.queryId) : null;
                return (
                  <option key={c.key} value={c.queryId ?? c.key}>
                    [{i + 1}] {q?.name ?? c.initial?.name ?? "New query (unsaved)"}
                    {q?.chart ? "  · chart" : ""}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              className="btn btn-quiet !min-h-10 !px-3 text-[14px]"
              onClick={() => setRunAllSignal((n) => n + 1)}
              disabled={engine.configured === false || cells.length === 0}
              title="Run every cell, top to bottom, one at a time"
            >
              Run all
            </button>
            <button type="button" className="btn !min-h-10 !px-3 text-[14px]" onClick={() => addCell()}>
              + Cell
            </button>
          </div>

          {cells.length === 0 && (
            <div className="sheet p-5">
              <p className="font-semibold">No cells yet</p>
              <p className="mt-1 text-[15px] text-muted">
                Each cell is one SQL query with its own result and chart. Saved cells appear on the dashboard and can be linked from the note.
              </p>
              <button type="button" className="btn mt-4" onClick={() => addCell()}>
                + Add a cell
              </button>
            </div>
          )}

          <ol className="space-y-4">
            {cells.map((c, i) => {
              const q = c.queryId ? (byId.get(c.queryId) ?? null) : null;
              const used = c.queryId ? usedInFor(c.queryId) : [];
              const active = !!c.queryId && c.queryId === currentId;
              return (
                <li
                  key={c.key}
                  id={`cell-${c.queryId ?? c.key}`}
                  className={`scroll-mt-[150px] rounded-xl border bg-surface p-3 sm:p-4 lg:scroll-mt-16 ${active ? "border-accent/60" : "border-line"}`}
                  onFocusCapture={() => c.queryId && focusCell(c.queryId)}
                >
                  <QueryEditor
                    projectId={project.id}
                    query={q && q.id === c.key ? q : null}
                    engine={engine}
                    onSaved={(saved, isNew) => onSaved(c.key, saved, isNew)}
                    compact
                    cell={{
                      index: i + 1,
                      draftId: c.draftId,
                      initial: c.initial,
                      onDelete: () => deleteCell(c.key, c.queryId),
                      onDuplicate: (f) => addCell(f, c.key),
                      runAllSignal,
                      autoFocus: c.autoFocus,
                    }}
                    aside={
                      c.queryId &&
                      used.length > 0 && (
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
                              <Link key={j} href={`/lab/projects/${project.id}/workspace?note=${u.noteId}&query=${c.queryId}`} className="rounded-full bg-sunken px-2.5 py-1 hover:text-accent">
                                {u.noteTitle}
                                {u.section ? ` › ${u.section}` : ""}
                              </Link>
                            ),
                          )}
                        </div>
                      )
                    }
                  />
                </li>
              );
            })}
          </ol>
          {cells.length > 0 && (
            <button type="button" className="mt-4 w-full rounded-xl border border-dashed border-line py-3 text-[14px] text-muted hover:border-accent hover:text-accent" onClick={() => addCell()}>
              + Add cell
            </button>
          )}
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
