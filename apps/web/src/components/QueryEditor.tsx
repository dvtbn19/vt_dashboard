"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ResultView } from "./ResultView";
import { deleteQuery, runSql, saveQuery } from "@/app/lab/workspace-actions";
import { ago } from "@/lib/format";
import { defaultChart, usableChart } from "@/lib/queryResult";
import { countStatements, pickStatement } from "@/lib/sqlStatements";
import type { ChartSpec, QueryEngine, QueryResult, SavedQuery } from "@/lib/types";

export type QueryFields = { name: string; description: string; sql: string; chart: ChartSpec | null };

/** Notebook mode: the editor is one cell among several on the workspace page. */
export type CellOptions = {
  /** 1-based position, shown as the cell's label. */
  index: number;
  /** Browser-draft key for a cell not saved yet (saved cells use their query id). */
  draftId: string;
  /** Starting content for a new cell (e.g. a duplicate). */
  initial?: QueryFields;
  /** Remove the cell; resolves to an error message, or null when done. */
  onDelete: () => Promise<string | null>;
  onDuplicate: (fields: QueryFields) => void;
  /** Bumped by "Run all": every cell runs once, one after another. */
  runAllSignal: number;
  /** Put the cursor in the SQL on mount (a freshly added cell). */
  autoFocus?: boolean;
};

/**
 * Cells run one at a time (auto-run on open and "Run all"), so a long notebook never opens a burst of
 * connections to the analytics database.
 */
let runQueue: Promise<unknown> = Promise.resolve();
function enqueue(task: () => Promise<unknown>) {
  const next = runQueue.then(task, task);
  runQueue = next.catch(() => undefined);
  return next;
}

type Props = {
  projectId: string;
  query: SavedQuery | null;
  engine: QueryEngine | null;
  /** Workspace mode: called after a save instead of changing the address to the query page. */
  onSaved?: (q: SavedQuery, isNew: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Workspace mode: start a new, empty query. */
  onNew?: () => void;
  /** Shown under the description (e.g. which notes use this query). */
  aside?: React.ReactNode;
  compact?: boolean;
  cell?: CellOptions;
};

export function QueryEditor({ projectId, query, engine, onSaved, onDirtyChange, onNew, aside, compact, cell }: Props) {
  const uid = useId();
  const start: QueryFields = query ?? {
    name: "",
    description: "",
    sql: "-- Read-only. Several statements? Run executes the one at the cursor (or the selection).\nselect current_date as today",
    chart: null,
    ...cell?.initial,
  };
  const [id, setId] = useState(query?.id ?? null);
  const [version, setVersion] = useState(query?.version ?? null);
  const [name, setName] = useState(start.name);
  const [description, setDescription] = useState(start.description);
  const [sql, setSql] = useState(start.sql);
  const [chart, setChart] = useState<ChartSpec | null>(start.chart ?? null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [ranLabel, setRanLabel] = useState<string | null>(null);
  const sqlRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [conflictVersion, setConflictVersion] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // A new cell's starting content counts as unsaved (a duplicate must not vanish on reload).
  const [snapshot, setSnapshot] = useState(() =>
    JSON.stringify(cell?.initial && !query ? { name: "", description: "", sql: "", chart: null } : { name, description, sql, chart }),
  );
  const dirty = JSON.stringify({ name, description, sql, chart }) !== snapshot;
  const canRun = engine?.configured !== false;
  const statements = useMemo(() => countStatements(sql), [sql]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Unsaved edits are mirrored to this browser, so a reload (e.g. right after a new deploy) never loses them.
  const newDraftId = cell?.draftId ?? "new";
  const draftKey = useCallback((qid: string | null) => `vtlab:query-draft:${projectId}:${qid ?? newDraftId}`, [projectId, newDraftId]);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const firstDraftWrite = useRef(true);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey(query?.id ?? null));
      if (!raw) return;
      const d = JSON.parse(raw) as { name: string; description: string; sql: string; chart: ChartSpec | null; at: string };
      if (JSON.stringify({ name: d.name, description: d.description, sql: d.sql, chart: d.chart }) === snapshot) return;
      /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from browser storage, only available after mount */
      setName(d.name);
      setDescription(d.description);
      setSql(d.sql);
      setChart(d.chart);
      setRestoredAt(d.at);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      /* storage unavailable or malformed: start from the saved query */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);
  useEffect(() => {
    if (firstDraftWrite.current) {
      firstDraftWrite.current = false;
      return;
    }
    const key = draftKey(id);
    const t = window.setTimeout(() => {
      try {
        if (dirty) window.localStorage.setItem(key, JSON.stringify({ name, description, sql, chart, at: new Date().toISOString() }));
        else window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [name, description, sql, chart, dirty, id, draftKey]);

  const discardDraft = () => {
    const s0 = JSON.parse(snapshot) as { name: string; description: string; sql: string; chart: ChartSpec | null };
    setName(s0.name);
    setDescription(s0.description);
    setSql(s0.sql);
    setChart(s0.chart);
    setRestoredAt(null);
    try {
      window.localStorage.removeItem(draftKey(id));
    } catch {
      /* ignore */
    }
  };

  const run = useCallback(async (fromUser = true) => {
    if (!sql.trim() || running) return;
    // Run the selection, or the statement under the cursor when the editor holds several.
    // Automatic runs (open, Run all) take the first statement, like the saved query's chart.
    const el = sqlRef.current;
    const picked = fromUser ? pickStatement(sql, el?.selectionStart ?? 0, el?.selectionEnd ?? 0) : pickStatement(sql, 0, 0);
    if (fromUser && el && picked.range) el.setSelectionRange(picked.range[0], picked.range[1]);
    setRunning(true);
    setRunError(null);
    setRanLabel(picked.label);
    const res = await runSql(picked.sql, engine?.max_rows ? Math.min(engine.max_rows, 5000) : 1000);
    setRunning(false);
    if (res.ok) {
      setResult(res.result);
      setChart((c) => usableChart(c, res.result) ?? (c ? null : defaultChart(res.result)));
    } else {
      setRunError(res.error);
    }
  }, [sql, running, engine]);

  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  // A saved query with a chart shows its chart right away (read-only, same limits as Run).
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !query?.chart || !canRun) return;
    const t = window.setTimeout(() => {
      autoRan.current = true;
      void enqueue(() => runRef.current(false));
    }, 0);
    return () => window.clearTimeout(t);
  }, [query, canRun]);

  // "Run all" in notebook mode.
  const runAll = cell?.runAllSignal ?? 0;
  const lastRunAll = useRef(runAll);
  useEffect(() => {
    if (runAll === lastRunAll.current || !canRun) return;
    lastRunAll.current = runAll;
    void enqueue(() => runRef.current(false));
  }, [runAll, canRun]);

  useEffect(() => {
    if (cell?.autoFocus) sqlRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  const save = useCallback(
    async (baseVersion = version, asNew = false) => {
      setSaving(true);
      setSaveMsg(null);
      const sameName = !!query && name.trim() === query.name.trim();
      const fields = { name: asNew && sameName ? `${name.trim()} (copy)` : name, description, sql, chart };
      if (fields.name !== name) setName(fields.name);
      const targetId = asNew ? null : id;
      const res = await saveQuery(projectId, targetId, asNew ? null : baseVersion, fields);
      setSaving(false);
      if (res.ok) {
        setSnapshot(JSON.stringify(fields));
        setRestoredAt(null);
        try {
          window.localStorage.removeItem(draftKey(targetId));
          window.localStorage.removeItem(draftKey(res.id));
        } catch {
          /* ignore */
        }
        setVersion(res.version);
        setConflictVersion(null);
        setSaveMsg({ ok: true, text: `Saved · v${res.version} · ${ago(res.updated_at)}` });
        if (onSaved) {
          if (!targetId) setId(res.id);
          onSaved(
            {
              ...(query && !asNew ? query : { project_id: projectId, created_at: res.updated_at }),
              ...fields,
              name: fields.name.trim() || "Untitled query",
              id: res.id,
              version: res.version,
              updated_at: res.updated_at,
              last_edited_by: res.last_edited_by,
            },
            !targetId,
          );
        } else if (!targetId) {
          setId(res.id);
          // Update the address without navigating, so the result and chart on screen stay.
          window.history.replaceState(null, "", `/lab/projects/${projectId}/queries/${res.id}`);
        }
      } else {
        if (res.conflict) setConflictVersion(res.conflict.current_version);
        setSaveMsg({ ok: false, text: res.error });
      }
    },
    [version, name, description, sql, chart, projectId, id, onSaved, query, draftKey],
  );

  // ⌘/Ctrl+Enter runs, ⌘/Ctrl+S saves. A notebook cell only reacts to keys typed inside it.
  const onShortcut = useCallback(
    (e: { metaKey: boolean; ctrlKey: boolean; key: string; preventDefault: () => void }) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "Enter") {
        e.preventDefault();
        void run();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty || !id) void save();
      }
    },
    [run, save, dirty, id],
  );
  const inCell = !!cell;
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    if (!inCell) window.addEventListener("keydown", onShortcut);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      if (!inCell) window.removeEventListener("keydown", onShortcut);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [onShortcut, dirty, inCell]);

  const removeCell = async () => {
    if (!cell) return;
    setDeleting(true);
    setDeleteError(null);
    const err = await cell.onDelete();
    setDeleting(false);
    if (err) {
      setDeleteError(err);
      return;
    }
    try {
      window.localStorage.removeItem(draftKey(id));
    } catch {
      /* ignore */
    }
  };

  const onSqlKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: a, selectionEnd: b } = el;
      setSql(sql.slice(0, a) + "  " + sql.slice(b));
      requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2));
    }
  };

  return (
    <div onKeyDown={cell ? onShortcut : undefined}>
      {cell ? (
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[13px] text-muted">
            [{cell.index}]{dirty ? " · unsaved" : ""}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[13px] text-muted hover:bg-sunken hover:text-ink"
              onClick={() => cell.onDuplicate({ name: `${name.trim() || "Untitled query"} (copy)`, description, sql, chart })}
            >
              Duplicate
            </button>
            {confirmDelete ? (
              <span className="flex items-center gap-1">
                <button type="button" className="rounded-md bg-fail px-2 py-1 text-[13px] text-white" onClick={() => void removeCell()} disabled={deleting}>
                  {deleting ? "Deleting…" : id ? "Delete query" : "Remove cell"}
                </button>
                <button type="button" className="rounded-md px-2 py-1 text-[13px] text-muted hover:bg-sunken" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[13px] text-muted hover:bg-sunken hover:text-fail"
                onClick={() => (id || dirty ? setConfirmDelete(true) : void removeCell())}
                aria-label={`Delete cell ${cell.index}`}
              >
                Delete
              </button>
            )}
          </div>
          {deleteError && (
            <p role="alert" className="w-full text-[13.5px] text-fail">
              {deleteError}
            </p>
          )}
        </div>
      ) : (
        <label htmlFor={`${uid}-name`} className="hint mb-1 block">
          Query name · click to rename, then Save
        </label>
      )}
      <input
        id={`${uid}-name`}
        aria-label="Query name"
        className={`w-full rounded-md border border-dashed border-line bg-transparent px-2 py-1 font-bold leading-tight tracking-tight outline-none placeholder:text-muted hover:border-muted focus:border-solid focus:border-accent ${compact ? "text-[20px]" : "text-[26px]"}`}
        value={name}
        maxLength={200}
        placeholder="Name this query"
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        aria-label="Description"
        className="mt-2 w-full resize-y bg-transparent text-[15px] text-muted outline-none placeholder:text-muted/70 focus-visible:outline-2"
        rows={cell ? 1 : 2}
        maxLength={20000}
        value={description}
        placeholder="What does it answer? (optional)"
        onChange={(e) => setDescription(e.target.value)}
      />
      {aside}
      {restoredAt && dirty && (
        <div role="status" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-accent/40 bg-accent/8 px-3 py-2 text-[14px]">
          <span>
            Restored your unsaved changes from {ago(restoredAt)}. <strong>Save</strong> to keep them.
          </span>
          <button type="button" className="text-muted underline hover:text-fail" onClick={discardDraft}>
            Discard
          </button>
        </div>
      )}

      {engine && !engine.configured && (
        <p role="status" className="mt-3 rounded-lg bg-run/10 px-3 py-2 text-[14.5px] text-run">
          Running SQL is not set up yet: the API needs <code className="font-mono">ANALYTICS_DATABASE_URL</code> (a read-only database
          user). You can still write and save queries.
        </p>
      )}

      <label htmlFor={`${uid}-sql`} className={`label ${cell ? "mt-2" : "mt-4"}`}>
        SQL{" "}
        <span className="hint font-normal">
          · read-only, {engine?.timeout_seconds ?? 20}s limit
          {statements > 1 ? ` · ${statements} statements: Run executes the one at the cursor (or your selection)` : ""}
        </span>
      </label>
      <textarea
        ref={sqlRef}
        id={`${uid}-sql`}
        className={`field resize-y font-mono !text-[14px] leading-relaxed ${cell ? "min-h-[140px]" : compact ? "min-h-[200px]" : "min-h-[260px]"}`}
        value={sql}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={onSqlKey}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn" onClick={() => void run()} disabled={running || !canRun} aria-busy={running}>
          {running ? "Running…" : "Run"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => void save()} disabled={saving || (!dirty && !!id)}>
          {saving ? "Saving…" : id ? "Save" : "Save query"}
        </button>
        {id && !cell && (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => void save(null, true)}
            disabled={saving}
            title="Save a copy under the name above and keep the original"
          >
            Save as new
          </button>
        )}
        {id && onNew && !cell && (
          <button type="button" className="btn btn-quiet" onClick={onNew}>
            + New query
          </button>
        )}
        <span className="hint hidden sm:inline">⌘/Ctrl+Enter to run · ⌘/Ctrl+S to save</span>
        {statements > 1 && (
          <span className="hint w-full">Charts, links and the dashboard use the first statement of a saved query.</span>
        )}
        {saveMsg && (
          <span role="status" className={`text-[13.5px] ${saveMsg.ok ? "text-muted" : "text-fail"}`}>
            {saveMsg.ok && dirty ? "Unsaved changes" : saveMsg.text}
          </span>
        )}
        {!saveMsg && dirty && id && <span className="text-[13.5px] text-muted">Unsaved changes</span>}
      </div>
      {conflictVersion !== null && (
        <div role="alert" className="mt-3 rounded-lg border border-run/50 bg-run/10 p-3 text-[14.5px]">
          <p className="font-semibold text-run">This query was changed elsewhere (now v{conflictVersion}).</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn !min-h-10" onClick={() => void save(conflictVersion)}>
              Keep mine (overwrite)
            </button>
            <a className="btn btn-quiet !min-h-10" href="" target="_blank" rel="noopener">
              Open the latest in a new tab
            </a>
          </div>
        </div>
      )}

      <section className={cell ? "mt-4" : compact ? "mt-5" : "mt-8"} aria-label="Result">
        {runError && (
          <pre role="alert" className="whitespace-pre-wrap rounded-lg border border-fail/40 bg-fail/8 px-3 py-2 font-mono text-[13.5px] text-fail">
            {runError}
          </pre>
        )}
        {ranLabel && (result || runError) && <p className="mb-2 text-[13.5px] text-muted">Ran {ranLabel}</p>}
        {result ? (
          <ResultView result={result} name={name || "query"} spec={chart} onSpecChange={setChart} />
        ) : (
          !runError &&
          (cell ? (
            <p className="text-[14px] text-muted">{running ? "Running…" : "Not run yet."}</p>
          ) : (
            <p className="text-muted">Run the query to see results. Charts you set up here are saved with the query and shown on the dashboard.</p>
          ))
        )}
      </section>

      {id && !cell && (
        <div className="mt-12 border-t border-line pt-5">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[14.5px]">Delete this saved query?</span>
              <form action={deleteQuery.bind(null, id, projectId)}>
                <button type="submit" className="btn !bg-fail">
                  Delete
                </button>
              </form>
              <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="text-[14px] text-muted underline hover:text-fail" onClick={() => setConfirmDelete(true)}>
              Delete query
            </button>
          )}
        </div>
      )}
    </div>
  );
}
