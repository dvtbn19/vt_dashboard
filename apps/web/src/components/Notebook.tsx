"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutoTextarea } from "./AutoTextarea";
import { Markdown } from "./Markdown";
import { QueryEditor, type QueryFields } from "./QueryEditor";
import { removeQuery, saveNotebook } from "@/app/lab/workspace-actions";
import { headingsOf, publishToc, scrollToHeading, type TocItem } from "@/lib/notebookToc";
import type { Notebook as NotebookData, NotebookCell, QueryEngine, SavedQuery } from "@/lib/types";

/** A cell on screen: a SQL cell (saved query, or new and not saved yet) or a Markdown cell. */
type Cell =
  | { kind: "sql"; key: string; queryId: string | null; draftId: string; initial?: QueryFields; autoFocus?: boolean }
  | { kind: "md"; key: string; text: string; editing: boolean };

type Heading = TocItem;

const DRAFT_PREFIX = "vtlab:query-draft:";

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** What gets saved: unsaved SQL cells are left out until they are saved as queries. */
function layoutOf(cells: Cell[]): NotebookCell[] {
  const out: NotebookCell[] = [];
  for (const c of cells) {
    if (c.kind === "md") out.push({ type: "markdown", id: c.key, text: c.text });
    else if (c.queryId) out.push({ type: "sql", query_id: c.queryId });
  }
  return out;
}

/** Saved order first; queries missing from it (new, or made through the API) follow in creation order. */
function initialCells(queries: SavedQuery[], notebook: NotebookData | null): Cell[] {
  const known = new Set(queries.map((q) => q.id));
  const placed = new Set<string>();
  const cells: Cell[] = [];
  for (const c of notebook?.cells ?? []) {
    if (c.type === "markdown") cells.push({ kind: "md", key: c.id, text: c.text, editing: false });
    else if (known.has(c.query_id) && !placed.has(c.query_id)) {
      placed.add(c.query_id);
      cells.push({ kind: "sql", key: c.query_id, queryId: c.query_id, draftId: c.query_id });
    }
  }
  for (const q of [...queries].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (!placed.has(q.id)) cells.push({ kind: "sql", key: q.id, queryId: q.id, draftId: q.id });
  }
  return cells;
}

const iconBtn = "rounded-md px-2 py-1 text-[13px] text-muted hover:bg-sunken hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent";

type Props = {
  projectId: string;
  queries: SavedQuery[];
  engine: QueryEngine;
  notebook: NotebookData | null;
  currentId: string | null;
  initialQueryId: string | null;
  onQuerySaved: (q: SavedQuery, isNew: boolean) => void;
  onQueryDeleted: (id: string) => void;
  onFocusQuery: (id: string) => void;
  /** Extra line under a saved SQL cell's description (where the query is used). */
  asideFor: (queryId: string) => React.ReactNode;
};

/**
 * A SQL notebook, like a Jupyter notebook: SQL cells (each a saved query with its own result and chart)
 * and Markdown cells, in an order that is saved with the project. `#` headings in Markdown cells make
 * the table of contents.
 */
export function Notebook({ projectId, queries, engine, notebook, currentId, initialQueryId, onQuerySaved, onQueryDeleted, onFocusQuery, asideFor }: Props) {
  const [cells, setCells] = useState<Cell[]>(() => initialCells(queries, notebook));
  const [runAllSignal, setRunAllSignal] = useState(0);
  const byId = useMemo(() => new Map(queries.map((q) => [q.id, q])), [queries]);

  // ---- restore new SQL cells that were never saved (kept in this browser)
  useEffect(() => {
    const restored: Cell[] = [];
    try {
      const prefix = `${DRAFT_PREFIX}${projectId}:`;
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k?.startsWith(prefix)) continue;
        const draftId = k.slice(prefix.length);
        if (draftId === "new" || draftId.startsWith("new-")) restored.push({ kind: "sql", key: draftId, queryId: null, draftId });
      }
    } catch {
      /* storage unavailable */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after mount
    if (restored.length) setCells((cs) => [...cs, ...restored]);
  }, [projectId]);

  useEffect(() => {
    if (initialQueryId) document.getElementById(`cell-${initialQueryId}`)?.scrollIntoView({ block: "start" });
  }, [initialQueryId]);

  // ---- save the order and Markdown cells (debounced), with the same version check as notes
  const available = notebook !== null;
  const [version, setVersion] = useState(notebook?.version ?? 0);
  const [saveState, setSaveState] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "conflict"; text?: string; current?: number }>({ kind: "idle" });
  const layout = useMemo(() => JSON.stringify(layoutOf(cells)), [cells]);
  const savedLayout = useRef(JSON.stringify(layoutOf(initialCells(queries, notebook))));
  const doSave = useCallback(
    async (base: number) => {
      const body = layout;
      setSaveState({ kind: "saving" });
      const res = await saveNotebook(projectId, base, JSON.parse(body) as NotebookCell[]);
      if (res.ok) {
        savedLayout.current = body;
        setVersion(res.version);
        setSaveState({ kind: "saved" });
      } else if (res.conflict) {
        setSaveState({ kind: "conflict", current: res.conflict.current_version });
      } else {
        setSaveState({ kind: "error", text: res.error });
      }
    },
    [layout, projectId],
  );
  useEffect(() => {
    if (!available || layout === savedLayout.current || saveState.kind === "conflict" || saveState.kind === "saving") return;
    const t = window.setTimeout(() => void doSave(version), 700);
    return () => window.clearTimeout(t);
  }, [available, layout, version, saveState.kind, doSave]);

  // ---- cell operations
  const insertAt = useCallback((cell: Cell, afterKey?: string | null) => {
    setCells((cs) => {
      if (afterKey === null) return [cell, ...cs]; // top
      const at = afterKey ? cs.findIndex((c) => c.key === afterKey) : -1;
      return at === -1 ? [...cs, cell] : [...cs.slice(0, at + 1), cell, ...cs.slice(at + 1)];
    });
    requestAnimationFrame(() => document.getElementById(`cell-${cell.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, []);

  const addSql = useCallback(
    (afterKey?: string | null, initial?: Partial<QueryFields>) => {
      const used = new Set([
        ...queries.map((q) => q.name.trim().toLowerCase()),
        ...cells.flatMap((c) => (c.kind === "sql" && c.initial ? [c.initial.name.trim().toLowerCase()] : [])),
      ]);
      const base = initial?.name ?? "Query";
      let name = initial?.name ?? `Query ${cells.filter((c) => c.kind === "sql").length + 1}`;
      for (let i = 2; used.has(name.trim().toLowerCase()); i++) name = `${base} ${i}`;
      const key = `new-${newKey()}`;
      insertAt(
        { kind: "sql", key, queryId: null, draftId: key, autoFocus: true, initial: { description: "", sql: "select current_date as today", chart: null, ...initial, name } },
        afterKey,
      );
    },
    [queries, cells, insertAt],
  );

  const addMarkdown = useCallback(
    (afterKey?: string | null) => insertAt({ kind: "md", key: `md-${newKey().slice(0, 18)}`, text: "", editing: true }, afterKey),
    [insertAt],
  );

  const move = (key: string, delta: -1 | 1) =>
    setCells((cs) => {
      const i = cs.findIndex((c) => c.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const setMd = (key: string, patch: Partial<{ text: string; editing: boolean }>) =>
    setCells((cs) => cs.map((c) => (c.key === key && c.kind === "md" ? { ...c, ...patch } : c)));

  const removeCell = (key: string) => setCells((cs) => cs.filter((c) => c.key !== key));

  const deleteSql = useCallback(
    async (key: string, queryId: string | null): Promise<string | null> => {
      if (queryId) {
        const res = await removeQuery(queryId, projectId);
        if (!res.ok) return res.error;
        onQueryDeleted(queryId);
      }
      removeCell(key);
      return null;
    },
    [projectId, onQueryDeleted],
  );

  // ---- table of contents: headings of Markdown cells, with the SQL cells under them
  const contents = useMemo(() => {
    const items: (Heading | { sql: true; cellKey: string; name: string; index: number })[] = [];
    cells.forEach((c, i) => {
      if (c.kind === "md") headingsOf(c.text).forEach((h, nth) => items.push({ ...h, cellKey: c.key, nth }));
      else items.push({ sql: true, cellKey: c.queryId ?? c.key, name: (c.queryId && byId.get(c.queryId)?.name) || c.initial?.name || "New query", index: i + 1 });
    });
    return items;
  }, [cells, byId]);
  const headingCount = contents.filter((x) => !("sql" in x)).length;
  // Share the headings with the lab sidebar's "Notebook contents".
  const tocKey = JSON.stringify(contents.filter((x): x is Heading => !("sql" in x)));
  useEffect(() => {
    publishToc(JSON.parse(tocKey) as TocItem[]);
  }, [tocKey]);
  useEffect(() => () => publishToc([]), []);
  const tocRef = useRef<HTMLDetailsElement>(null);
  const goTo = (cellKey: string, nth?: number) => {
    tocRef.current?.removeAttribute("open");
    scrollToHeading(cellKey, nth);
  };
  const minLevel = Math.min(6, ...contents.flatMap((x) => ("sql" in x ? [] : [x.level])));

  const insertBar = (afterKey: string | null, always = false) => (
    <div className={`group/ins flex items-center gap-2 py-1.5 ${always ? "" : "opacity-100 sm:opacity-60 sm:hover:opacity-100 sm:focus-within:opacity-100"}`}>
      <span className="h-px flex-1 bg-line" aria-hidden />
      <button type="button" className="rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-muted hover:border-accent hover:text-accent" onClick={() => addSql(afterKey)}>
        + SQL
      </button>
      <button type="button" className="rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-muted hover:border-accent hover:text-accent" onClick={() => addMarkdown(afterKey)}>
        + Markdown
      </button>
      <span className="h-px flex-1 bg-line" aria-hidden />
    </div>
  );

  return (
    <div>
      {/* toolbar */}
      <div className="sticky top-[100px] z-10 flex flex-wrap items-center gap-2 bg-bg/95 pb-2 pt-1 backdrop-blur lg:top-0">
        <details ref={tocRef} className="relative min-w-0 flex-1">
          <summary className="field flex !min-h-10 cursor-pointer list-none items-center justify-between !py-1.5 text-[15px] [&::-webkit-details-marker]:hidden">
            <span className="truncate">
              Contents · {cells.length} cell{cells.length === 1 ? "" : "s"}
              {headingCount ? ` · ${headingCount} heading${headingCount === 1 ? "" : "s"}` : ""}
            </span>
            <span aria-hidden className="text-muted">
              ▾
            </span>
          </summary>
          <nav aria-label="Notebook contents" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[60vh] overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-lg">
            {contents.length === 0 && <p className="px-2 py-1 text-[14px] text-muted">No cells yet.</p>}
            {headingCount === 0 && contents.length > 0 && (
              <p className="px-2 pb-1 text-[13px] text-muted">Tip: add a Markdown cell with `# Heading` lines to build a table of contents.</p>
            )}
            <ul>
              {contents.map((x, i) =>
                "sql" in x ? (
                  <li key={i}>
                    <button type="button" className="block w-full truncate rounded-md px-2 py-1 text-left font-mono text-[12.5px] text-muted hover:bg-sunken hover:text-ink" style={{ paddingLeft: headingCount ? 20 : 8 }} onClick={() => goTo(x.cellKey)}>
                      [{x.index}] {x.name}
                    </button>
                  </li>
                ) : (
                  <li key={i}>
                    <button
                      type="button"
                      className={`block w-full truncate rounded-md px-2 py-1 text-left hover:bg-sunken ${x.level === minLevel ? "text-[14.5px] font-semibold" : "text-[14px]"}`}
                      style={{ paddingLeft: 8 + (x.level - minLevel) * 14 }}
                      onClick={() => goTo(x.cellKey, x.nth)}
                    >
                      {x.text}
                    </button>
                  </li>
                ),
              )}
            </ul>
          </nav>
        </details>
        <button
          type="button"
          className="btn btn-quiet !min-h-10 !px-3 text-[14px]"
          onClick={() => setRunAllSignal((n) => n + 1)}
          disabled={engine.configured === false || !cells.some((c) => c.kind === "sql")}
          title="Run every SQL cell, top to bottom, one at a time"
        >
          Run all
        </button>
      </div>
      <p className="mb-1 min-h-5 text-[12.5px] text-muted" role="status">
        {!available
          ? "Cell order and Markdown cells are not saved yet: the API database needs migration 0005."
          : saveState.kind === "saving"
            ? "Saving notebook…"
            : saveState.kind === "error"
              ? `Notebook not saved: ${saveState.text}`
              : saveState.kind === "saved"
                ? "Notebook saved"
                : ""}
      </p>
      {saveState.kind === "conflict" && (
        <div role="alert" className="mb-3 rounded-lg border border-run/50 bg-run/10 p-3 text-[14px]">
          <p className="font-semibold text-run">The notebook was changed in another tab or by an agent (now v{saveState.current}).</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn !min-h-9" onClick={() => void doSave(saveState.current ?? version)}>
              Keep this order (overwrite)
            </button>
            <button type="button" className="btn btn-quiet !min-h-9" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      )}

      {cells.length === 0 ? (
        <div className="sheet p-5">
          <p className="font-semibold">Empty notebook</p>
          <p className="mt-1 text-[15px] text-muted">
            Add SQL cells (each with its own result and chart) and Markdown cells for headings and commentary. `#` headings make the table of contents.
          </p>
          <div className="mt-3">{insertBar(null, true)}</div>
        </div>
      ) : (
        insertBar(null)
      )}

      <ol>
        {cells.map((c, i) => {
          const moveBtns = (
            <>
              <button type="button" className={iconBtn} onClick={() => move(c.key, -1)} disabled={i === 0} aria-label={`Move cell ${i + 1} up`} title="Move up">
                ↑
              </button>
              <button type="button" className={iconBtn} onClick={() => move(c.key, 1)} disabled={i === cells.length - 1} aria-label={`Move cell ${i + 1} down`} title="Move down">
                ↓
              </button>
            </>
          );
          if (c.kind === "md") {
            return (
              <li key={c.key} id={`cell-${c.key}`} className="scroll-mt-[150px] lg:scroll-mt-16">
                <div className={`group rounded-xl border p-3 sm:p-4 ${c.editing ? "border-accent/60 bg-surface" : "border-transparent hover:border-line"}`}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px] text-muted">Markdown</span>
                    <div className="flex items-center gap-1">
                      {moveBtns}
                      <button type="button" className={iconBtn} onClick={() => setMd(c.key, { editing: !c.editing })}>
                        {c.editing ? "Done" : "Edit"}
                      </button>
                      <button
                        type="button"
                        className={`${iconBtn} hover:!text-fail`}
                        onClick={() => (c.text.trim() && !window.confirm("Delete this Markdown cell?") ? undefined : removeCell(c.key))}
                        aria-label={`Delete cell ${i + 1}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {c.editing ? (
                    <>
                      <AutoTextarea
                        aria-label={`Markdown cell ${i + 1}`}
                        className="field font-mono !text-[14px] leading-relaxed"
                        minRows={3}
                        value={c.text}
                        autoFocus
                        placeholder={"# Section heading\n\nNotes, findings, links… (Shift+Enter to finish)"}
                        onChange={(v) => setMd(c.key, { text: v })}
                        onKeyDown={(e) => {
                          if ((e.key === "Enter" && (e.shiftKey || e.metaKey || e.ctrlKey)) || e.key === "Escape") {
                            e.preventDefault();
                            setMd(c.key, { editing: false });
                          }
                        }}
                      />
                      <p className="hint mt-1">Shift+Enter or Esc to show it · `#`, `##`, `###` headings go in the contents</p>
                    </>
                  ) : c.text.trim() ? (
                    <div onDoubleClick={() => setMd(c.key, { editing: true })} title="Double-click to edit">
                      <Markdown text={c.text} />
                    </div>
                  ) : (
                    <button type="button" className="text-[14px] text-muted" onClick={() => setMd(c.key, { editing: true })}>
                      Empty Markdown cell: click to write
                    </button>
                  )}
                </div>
                {insertBar(c.key)}
              </li>
            );
          }
          const q = c.queryId ? (byId.get(c.queryId) ?? null) : null;
          const active = !!c.queryId && c.queryId === currentId;
          return (
            <li key={c.key} id={`cell-${c.queryId ?? c.key}`} className="scroll-mt-[150px] lg:scroll-mt-16" onFocusCapture={() => c.queryId && onFocusQuery(c.queryId)}>
              <div className={`rounded-xl border bg-surface p-3 sm:p-4 ${active ? "border-accent/60" : "border-line"}`}>
                <QueryEditor
                  projectId={projectId}
                  query={q && q.id === c.key ? q : null}
                  engine={engine}
                  onSaved={(saved, isNew) => {
                    if (isNew) setCells((cs) => cs.map((x) => (x.key === c.key && x.kind === "sql" ? { ...x, queryId: saved.id } : x)));
                    onQuerySaved(saved, isNew);
                  }}
                  compact
                  cell={{
                    index: i + 1,
                    draftId: c.draftId,
                    initial: c.initial,
                    onDelete: () => deleteSql(c.key, c.queryId),
                    onDuplicate: (f) => addSql(c.key, f),
                    runAllSignal,
                    autoFocus: c.autoFocus,
                    actions: moveBtns,
                  }}
                  aside={c.queryId ? asideFor(c.queryId) : null}
                />
              </div>
              {insertBar(c.key)}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
